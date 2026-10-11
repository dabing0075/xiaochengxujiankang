import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const header = request.headers?.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      throw new UnauthorizedException('管理员未登录');
    }

    try {
      const payload = this.jwtService.verify<{ role: string }>(token);
      if (payload.role !== 'admin') {
        throw new UnauthorizedException('管理员未登录');
      }
      request.admin = payload;
    } catch {
      throw new UnauthorizedException('管理员未登录或登录已过期');
    }
    return true;
  }
}
