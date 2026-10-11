import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUser {
  userId: string;
  phone: string;
}

/**
 * 从 request.user 提取当前登录用户。
 * 用法：@CurrentUser('userId') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUser | undefined;
    return data ? user?.[data] : user;
  },
);
