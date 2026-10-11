import { Controller, Get, Post, Param } from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { CurrentUser } from '../auth/current-user.decorator'

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * 获取用户通知列表
   */
  @Get()
  async getNotifications(@CurrentUser('userId') userId: string) {
    console.log('[NotificationsController] GET /api/notifications')
    console.log('[NotificationsController] userId:', userId)

    const data = await this.notificationsService.getUserNotifications(userId)
    console.log('[NotificationsController] 返回通知数量:', data.length)

    return {
      code: 200,
      msg: 'success',
      data,
    }
  }

  /**
   * 获取未读通知数量
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser('userId') userId: string) {
    console.log('[NotificationsController] GET /api/notifications/unread-count')

    const count = await this.notificationsService.getUnreadCount(userId)
    console.log('[NotificationsController] 未读数量:', count)

    return {
      code: 200,
      msg: 'success',
      data: { count },
    }
  }

  /**
   * 标记通知为已读
   */
  @Post(':id/read')
  async markAsRead(
    @CurrentUser('userId') userId: string,
    @Param('id') notificationId: string,
  ) {
    console.log('[NotificationsController] POST /api/notifications/' + notificationId + '/read')

    const result = await this.notificationsService.markAsRead(notificationId, userId)
    return {
      code: 200,
      msg: 'success',
      data: result,
    }
  }
}
