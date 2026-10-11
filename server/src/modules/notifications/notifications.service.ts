import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

// 用户已读通知记录（内存缓存，用于快速判断已读状态）
const userReadNotifications: Record<string, Set<string>> = {}

// 获取用户已读记录
function getUserReadSet(userId: string): Set<string> {
  if (!userReadNotifications[userId]) {
    userReadNotifications[userId] = new Set<string>()
  }
  return userReadNotifications[userId]
}

@Injectable()
export class NotificationsService {
  /**
   * 获取用户通知列表（全局通知 + 个人通知）
   */
  async getUserNotifications(userId: string) {
    const client = getSupabaseClient()
    const readSet = getUserReadSet(userId)

    // 从数据库获取全局通知
    const { data: globalData, error: globalError } = await client
      .from('global_notifications')
      .select('*')
      .order('created_at', { ascending: false })

    if (globalError) {
      console.error('获取全局通知失败:', globalError)
    }

    // 格式化全局通知
    const globalNotifs = (globalData || []).map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      date: n.created_at.split('T')[0],
      read: readSet.has(n.id),
    }))

    // 获取用户个人通知
    let personalNotifs: any[] = []
    const { data: userData, error: userError } = await client
      .from('user_notifications')
      .select(`
        id,
        is_read,
        created_at,
        notification:global_notifications(id, title, content, type)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (userError) {
      console.error('获取用户通知失败:', userError)
    }

    if (userData) {
      personalNotifs = userData.map((n: any) => ({
        id: n.id,
        type: n.notification?.type || 'system',
        title: n.notification?.title || '',
        content: n.notification?.content || '',
        date: n.created_at.split('T')[0],
        read: n.is_read,
      }))
    }

    // 合并并按时间排序
    const allNotifications = [...globalNotifs, ...personalNotifs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return allNotifications
  }

  /**
   * 标记通知为已读
   */
  async markAsRead(notificationId: string, userId: string) {
    const client = getSupabaseClient()

    // 更新内存中的已读记录
    const readSet = getUserReadSet(userId)
    readSet.add(notificationId)

    // 更新数据库中的用户通知已读状态
    const { error } = await client
      .from('user_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('notification_id', notificationId)
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
