import { Controller, Post, Body } from '@nestjs/common';
import { AuthService, PHONE_RE } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('send-code')
  async sendCode(@Body() body: { phone: string }) {
    const { phone } = body || {};
    if (!phone || !PHONE_RE.test(phone)) {
      return { code: 400, msg: '手机号格式不正确', data: null };
    }
    return this.authService.sendCode(phone);
  }

  @Public()
  @Post('login')
  async login(@Body() body: { phone: string; code: string }) {
    const { phone, code } = body || {};
    if (!phone || !code) {
      return { code: 400, msg: '手机号和验证码不能为空', data: null };
    }
    try {
      const data = await this.authService.login(phone, code);
      return { code: 200, msg: 'success', data };
    } catch (err) {
      return { code: 400, msg: (err as Error).message, data: null };
    }
  }
}
