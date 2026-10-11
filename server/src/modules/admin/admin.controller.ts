import { Controller, Post, Get, Delete, Body, Query, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { Public } from '../auth/public.decorator';

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // 管理员登录
  @Public()
  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    return this.adminService.validateAdmin(body.username, body.password);
  }

  // 获取客户列表
  @Get('customers')
  async getCustomers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.adminService.getCustomers(
      parseInt(page || '1'),
      parseInt(pageSize || '10'),
      sortBy || 'created_at',
      sortOrder || 'desc',
    );
  }

  // 获取客户详情
  @Get('customers/:id')
  async getCustomerDetail(@Param('id') userId: string) {
    const result = await this.adminService.getCustomerDetail(userId);
    if (!result) {
      return { code: 404, message: '用户不存在' };
    }
    return { code: 200, data: result };
  }

  // 获取统计数据
  @Get('statistics')
  async getStatistics() {
    const data = await this.adminService.getStatistics();
    return { code: 200, data };
  }

  // 获取减重排行榜
  @Get('ranking')
  async getRanking(@Query('limit') limit?: string) {
    const data = await this.adminService.getWeightLossRanking(
      parseInt(limit || '10'),
    );
    return { code: 200, data };
  }

  // 创建通知
  @Post('notifications')
  async createNotification(
    @Body() body: { title: string; content: string; type?: string; targetUsers?: string[] },
  ) {
    return this.adminService.createNotification(
      body.title,
      body.content,
      body.type,
      body.targetUsers,
    );
  }

  // 获取通知列表
  @Get('notifications')
  async getNotifications(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.adminService.getNotifications(
      parseInt(page || '1'),
      parseInt(pageSize || '20'),
    );
  }

  // 删除通知
  @Delete('notifications/:id')
  async deleteNotification(@Param('id') id: string) {
    return this.adminService.deleteNotification(id);
  }

  // 获取所有用户（用于推送选择）
  @Get('users')
  async getAllUsers() {
    const data = await this.adminService.getAllUsersForNotification();
    return { code: 200, data };
  }
}
