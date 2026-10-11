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
}
