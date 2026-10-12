import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getSupabaseClient } from '../../storage/database/supabase-client';
import { generateCode, storeCode, verifyCode } from './codes';

export const PHONE_RE = /^1[3-9]\d{9}$/;

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async sendCode(phone: string) {
    const code = generateCode();
    storeCode(phone, code);
    console.log(`[Auth] Verification code for ${phone}: ${code}`);

    const data: Record<string, any> = { expiresIn: 300 };
    if ((process.env.NODE_ENV || 'development') !== 'production') {
      data.devCode = code;
    }
    return { code: 200, msg: '验证码已发送', data };
  }

  private async getUserByPhone(phone: string) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();
    if (error) throw new Error(`查询用户失败: ${error.message}`);
    return data || null;
  }

  private async createUser(phone: string) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('users')
      .insert({ phone, nickname: '用户' })
      .select()
      .single();
    if (error) throw new Error(`创建用户失败: ${error.message}`);
    return data;
  }

  async login(phone: string, code: string) {
    if (!verifyCode(phone, code)) {
      throw new Error('验证码错误或已过期');
    }

    let user = await this.getUserByPhone(phone);
    const isNew = !user;
    if (isNew) {
      user = await this.createUser(phone);
    }

    const onboarded = !!user.onboarded;
    const token = this.jwtService.sign({ userId: user.id, phone });
    return { token, user, isNew, onboarded };
  }

  /**
   * 用 wx.login 返回的 code 换取 openid（微信 jscode2session）。
   * 未配置 WX_APPID/WX_SECRET 时（开发/游客模式）回退为基于 code 的确定性 openid，方便本地联调。
   */
  private async code2session(code: string): Promise<{ openid: string; session_key?: string }> {
    const appid = process.env.WX_APPID || '';
    const secret = process.env.WX_SECRET || '';

    if (!appid || !secret) {
      return { openid: `dev_${code}` };
    }

    const url =
      'https://api.weixin.qq.com/sns/jscode2session' +
      `?appid=${encodeURIComponent(appid)}` +
      `&secret=${encodeURIComponent(secret)}` +
      `&js_code=${encodeURIComponent(code)}` +
      '&grant_type=authorization_code';

    const res = await fetch(url);
    const data = (await res.json()) as {
      openid?: string;
      session_key?: string;
      errcode?: number;
      errmsg?: string;
    };

    if (data.errcode || !data.openid) {
      throw new Error(`微信登录失败: ${data.errmsg || data.errcode}`);
    }
    return { openid: data.openid, session_key: data.session_key };
  }

  private async getUserByOpenid(openid: string) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('openid', openid)
      .maybeSingle();
    if (error) throw new Error(`查询微信用户失败: ${error.message}`);
    return data || null;
  }

  private async createWechatUser(openid: string, profile?: { nickname?: string; avatarUrl?: string }) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('users')
      .insert({
        openid,
        nickname: profile?.nickname || '微信用户',
        avatar_url: profile?.avatarUrl || null,
      })
      .select()
      .single();
    if (error) throw new Error(`创建微信用户失败: ${error.message}`);
    return data;
  }

  /**
   * 微信授权登录：用 code 换 openid，按 openid 找/建用户并签发 JWT。
   * silent=true 时仅做「检测」：老用户返回 token 自动登录，新用户不创建账号。
   */
  async wechatLogin(
    code: string,
    profile?: { nickname?: string; avatarUrl?: string },
    silent: boolean = false,
  ) {
    if (!code) throw new Error('缺少微信登录 code');

    const session = await this.code2session(code);
    const openid = session.openid;

    let user = await this.getUserByOpenid(openid);
    const isNew = !user;

    if (isNew) {
      if (silent) {
        // 静默检测：不创建账号，交由前端决定后续流程
        return { token: null, user: null, isNew: true, onboarded: false };
      }
      user = await this.createWechatUser(openid, profile);
    } else if (profile) {
      const client = getSupabaseClient();
      const patch: Record<string, any> = { updated_at: new Date().toISOString() };
      if (profile.nickname) patch.nickname = profile.nickname;
      if (profile.avatarUrl) patch.avatar_url = profile.avatarUrl;
      await client.from('users').update(patch).eq('id', user.id);
      user = await this.getUserByOpenid(openid);
    }

    const onboarded = !!user?.onboarded;
    const token = user
      ? this.jwtService.sign({ userId: user.id, phone: user.phone || '' })
      : null;
    return { token, user, isNew, onboarded };
  }

  /**
   * 绑定手机号（微信登录后）：把当前 openid 账号与手机号绑定，实现与 App 的跨端同步。
   * 若手机号已被其它账号占用，则把当前微信账号的数据归并到该手机号账号，并返回新 token。
   */
  async bindPhone(userId: string, phone: string, code: string) {
    if (!phone || !PHONE_RE.test(phone)) throw new Error('手机号格式不正确');
    if (!verifyCode(phone, code)) throw new Error('验证码错误或已过期');

    const client = getSupabaseClient();

    const { data: currentUser, error: currentError } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (currentError || !currentUser) throw new Error('用户不存在');
    if (currentUser.phone) throw new Error('该账号已绑定手机号');

    const openid = currentUser.openid || null;

    // 该手机号是否已被其它账号占用
    const { data: phoneUser } = await client
      .from('users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (phoneUser && phoneUser.id !== userId) {
      // 已存在手机号账号：先把当前微信账号的数据迁移过去，再删除当前账号、归并 openid
      await client.from('weight_records').update({ user_id: phoneUser.id }).eq('user_id', userId);
      await client.from('user_notifications').update({ user_id: phoneUser.id }).eq('user_id', userId);
      await client.from('users').delete().eq('id', userId);
      if (openid) {
        await client.from('users').update({ openid }).eq('id', phoneUser.id);
      }

      const { data: merged } = await client
        .from('users')
        .select('*')
        .eq('id', phoneUser.id)
        .single();
      const token = this.jwtService.sign({ userId: merged.id, phone: merged.phone });
      return { token, user: merged, onboarded: !!merged.onboarded, merged: true };
    }

    // 手机号未被占用：直接绑定到当前微信账号
    const { data: updated, error } = await client
      .from('users')
      .update({ phone })
      .eq('id', userId)
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new Error('该手机号已绑定其他账号');
      throw new Error('绑定手机号失败');
    }
    const token = this.jwtService.sign({ userId: updated.id, phone: updated.phone });
    return { token, user: updated, onboarded: !!updated.onboarded, merged: false };
  }
}
