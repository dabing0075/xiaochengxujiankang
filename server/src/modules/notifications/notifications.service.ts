import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class NotificationsService {
  /**
   * 获取用户通知列表。
   * 以 user_notifications 为唯一事实源：后台发通知（广播/定向）都会 fan-out 到
   * user_notifications，App 与小程序读取同一套数据、结果一致。
   */
  async getUserNotifications(userId: string) {
    const client = getSupabaseClient()

    const { data, error } = await client
      .from('user_notifications')
      .select(`
        id,
        is_read,
        created_at,
        notification:global_notifications(id, title, content, type)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('获取用户通知失败:', error)
      return []
    }

    return (data || []).map((n: any) => ({
      id: n.id,
      type: n.notification?.type || 'system',
      title: n.notification?.title || '',
      content: n.notification?.content || '',
      date: (n.created_at || '').split('T')[0],
      read: !!n.is_read,
    }))
  }

  /**
   * 标记通知为已读（notificationId 为 user_notifications.id）
   */
  async markAsRead(notificationId: string, userId: string) {
    const client = getSupabaseClient()

    const { error } = await client
      .from('user_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId)

    if (error) {
      console.log('更新用户通知已读状态:', error)
    }

    return { success: true }
  }

  /**
   * 获取未读通知数量
   */
  async getUnreadCount(userId: string): Promise<number> {
    const notifications = await this.getUserNotifications(userId)
    return notifications.filter(n => !n.read).length
  }
}
