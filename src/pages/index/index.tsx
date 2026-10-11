import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { Network } from '@/network'
import { isLoggedIn } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { 
  Bell, 
  Scale, 
  Ruler, 
  Activity, 
  Percent,
  CircleCheck,
  FileText,
  Target,
  Calendar,
  Trophy,
  Info,
  Heart,
  Clock,
  Flame,
  PersonStanding
} from 'lucide-react-taro'

// 用户信息接口
interface UserInfo {
  id: string
  nickname: string
  gender: string
  birth_date: string
  height: number
  target_weight: number
  target_waist: number
  avatar_url: string | null
  // 健康指标（从用户表直接获取）
  current_weight?: number
  current_waist?: number
  bmi?: number
  bmi_level?: string
  body_fat_rate?: number
  body_fat_level?: string
  waist_level?: string
  last_checkin_date?: string
}

// 健康指标接口
interface HealthMetrics {
  currentWeight: number
  currentWaist: number
  bmi: number
  bmiLevel: string
  bodyFatRate: number
  bodyFatLevel: string
  waistLevel: string
  weightDiff: number
  todayCheckedIn: boolean
  healthScore?: number
  bodyAge?: number
  bmr?: number
  bodyType?: string
}

// 趋势数据接口
interface TrendPoint {
  date: string
  weight: number
}

interface TrendResponse {
  weightTrend: TrendPoint[]
  waistTrend: Array<{ date: string; waist: number }>
  weightStats: {
    start: number
    end: number
    change: number
    changePercent: number
  }
  waistStats: {
    start: number
    end: number
    change: number
    changePercent: number
  }
}

// 通知接口
interface Notification {
  id: string
  type: 'checkin' | 'goal' | 'system' | 'achievement'
  title: string
  content: string
  date: string
  read: boolean
}

export default function HomePage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null)
  const [trendData, setTrendData] = useState<TrendResponse | null>(null)
  const [showNotificationDialog, setShowNotificationDialog] = useState(false)
  const [showNotificationDetail, setShowNotificationDetail] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    // 未登录则跳转登录页
    if (!isLoggedIn()) {
      Taro.reLaunch({ url: '/pages/login/index' })
      return
    }
    loadData()
    loadUnreadCount()
    
    // 定时轮询未读消息数量（每30秒检查一次）
    const pollInterval = setInterval(() => {
      loadUnreadCount()
    }, 30000)
    
    // 监听打卡成功事件，刷新数据
    const handleCheckinSuccess = () => {
      console.log('收到打卡成功事件，刷新数据')
      loadData()
      loadUnreadCount()
    }
    Taro.eventCenter.on('checkinSuccess', handleCheckinSuccess)
    
    return () => {
      clearInterval(pollInterval)
      Taro.eventCenter.off('checkinSuccess', handleCheckinSuccess)
    }
  }, [])

  // 页面显示时刷新所有数据（从其他页面返回或从后台切换回来）
  useDidShow(() => {
    loadData()
    loadUnreadCount()
  })

  // BMI健康等级颜色（与数据页一致）
  const getBmiColor = (level: string) => {
    switch (level) {
      case '体重过低':
      case '偏瘦':
        return '#3B82F6'
      case '正常':
        return '#3C8D6E'
      case '超重':
        return '#F59E0B'
      case '肥胖':
        return '#EF4444'
      default:
        return '#6B7280'
    }
  }

  // 体脂率/腰围健康等级颜色（与数据页一致）
  const getLevelColor = (level: string) => {
    switch (level) {
      case '正常':
        return '#3C8D6E'
      case '偏高':
      case '中心型肥胖前期':
        return '#F59E0B'
      case '肥胖':
      case '中心型肥胖':
        return '#EF4444'
      case '偏低':
        return '#3B82F6'
      default:
        return '#6B7280'
    }
  }

  const loadData = async () => {
    if (!isLoggedIn()) return
    try {
      // 获取用户信息
      const userRes = await Network.request({
        url: '/api/user/info',
        method: 'GET'
      })
      console.log('用户信息响应:', userRes.data)
      
      if (userRes.data?.code === 200 && userRes.data.data) {
        setUserInfo(userRes.data.data)
      }

      // 获取健康指标
      const metricsRes = await Network.request({
        url: '/api/health/metrics',
        method: 'GET'
      })
      console.log('健康指标响应:', metricsRes.data)
      
      if (metricsRes.data?.code === 200 && metricsRes.data.data) {
        setMetrics(metricsRes.data.data)
      }

      // 获取近7天趋势
      const trendRes = await Network.request({
        url: '/api/health/trend',
        method: 'GET',
        data: { days: 7 }
      })
      console.log('趋势数据响应:', trendRes.data)
      
      if (trendRes.data?.code === 200 && trendRes.data.data) {
        setTrendData(trendRes.data.data)
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  }

  // 加载未读通知数量
  const loadUnreadCount = async () => {
    if (!isLoggedIn()) return
    try {
      const res = await Network.request({
        url: '/api/notifications',
        method: 'GET'
      })
      console.log('通知响应:', res.data)
      
      if (res.data?.code === 200 && res.data.data) {
        const notifs = res.data.data as Notification[]
        const unread = notifs.filter((n: Notification) => !n.read).length
        setUnreadCount(unread)
      }
    } catch (error) {
      console.error('加载未读通知数量失败:', error)
    }
  }

  // 加载通知
  const loadNotifications = async () => {
    setLoadingNotifications(true)
    try {
      const res = await Network.request({
        url: '/api/notifications',
        method: 'GET'
      })
      console.log('通知响应:', res.data)
      
      if (res.data?.code === 200 && res.data.data) {
        setNotifications(res.data.data)
      }
    } catch (error) {
      console.error('加载通知失败:', error)
      // 如果接口不存在，显示模拟通知
      setNotifications(generateMockNotifications())
    } finally {
      setLoadingNotifications(false)
    }
  }

  // 生成模拟通知（当后端接口未实现时使用）
  const generateMockNotifications = (): Notification[] => {
    const today = new Date()
    const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    
    return [
      {
        id: '1',
        type: 'checkin',
        title: '打卡提醒',
        content: '今日还未打卡，记得记录您的体重数据哦！',
        date: formatDate(today),
        read: !metrics?.todayCheckedIn
      },
      {
        id: '2',
        type: 'goal',
        title: '目标进度',
        content: metrics?.weightDiff 
          ? `距离目标体重还差 ${Math.abs(metrics.weightDiff).toFixed(1)} 公斤，继续加油！`
          : '快去设置您的目标体重吧！',
        date: formatDate(new Date(today.getTime() - 86400000)),
        read: true
      },
      {
        id: '3',
        type: 'achievement',
        title: '健康小贴士',
        content: '每天保持规律作息，有助于维持健康的体重和良好的身体状态。',
        date: formatDate(new Date(today.getTime() - 86400000 * 2)),
        read: true
      },
      {
        id: '4',
        type: 'system',
        title: '系统通知',
        content: '欢迎使用健康管理小程序，祝您早日达成健康目标！',
        date: formatDate(new Date(today.getTime() - 86400000 * 3)),
        read: true
      }
    ]
  }

  // 打开通知列表弹窗
  const handleNotificationClick = async () => {
    await loadNotifications()
    setShowNotificationDialog(true)
  }

  // 点击某条通知，查看详情
  const handleNotificationItemClick = async (notification: Notification) => {
    setSelectedNotification(notification)
    setShowNotificationDetail(true)
    
    // 标记该通知为已读
    if (!notification.read) {
      try {
        await Network.request({
          url: `/api/notifications/${notification.id}/read`,
          method: 'POST'
        })
        // 更新本地状态
        setNotifications(prev => 
          prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
        )
        // 更新未读数量
        setUnreadCount(prev => Math.max(0, prev - 1))
      } catch (error) {
        console.error('标记通知已读失败:', error)
      }
    }
  }

  // 关闭详情弹窗
  const handleCloseDetail = () => {
    setShowNotificationDetail(false)
    setSelectedNotification(null)
    // 关闭详情后刷新未读数量
    loadUnreadCount()
  }

  // 关闭通知列表弹窗
  const handleCloseNotificationDialog = () => {
    setShowNotificationDialog(false)
    // 关闭列表后刷新未读数量
    loadUnreadCount()
  }

  // 截断内容显示（只显示第一行，最多20个字符）
  const truncateContent = (content: string, maxLength: number = 20) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  // 获取通知图标
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'checkin':
        return Calendar
      case 'goal':
        return Target
      case 'achievement':
        return Trophy
      case 'system':
        return Info
      default:
        return Bell
    }
  }

  // 获取通知图标颜色
  const getNotificationIconColor = (type: string) => {
    switch (type) {
      case 'checkin':
        return '#F26B3A'
      case 'goal':
        return '#3C8D6E'
      case 'achievement':
        return '#F59E0B'
      case 'system':
        return '#6B7280'
      default:
        return '#6B7280'
    }
  }

  const goToCheckin = () => {
    Taro.switchTab({ url: '/pages/checkin/index' })
  }

  const goToData = () => {
    Taro.switchTab({ url: '/pages/data/index' })
  }

  const goToProfile = () => {
    Taro.switchTab({ url: '/pages/profile/index' })
  }

  // 计算趋势图路径
  const generateTrendPath = () => {
    const weightTrend = trendData?.weightTrend || []
    if (weightTrend.length === 0) return { path: '', areaPath: '', points: [] }
    
    const width = 320
    const height = 100
    const padding = 10
    const weights = weightTrend.map(d => d.weight)
    const minWeight = Math.min(...weights) - 1
    const maxWeight = Math.max(...weights) + 1
    
    const xStep = (width - padding * 2) / (weightTrend.length - 1 || 1)
    const yScale = (height - padding * 2) / (maxWeight - minWeight || 1)
    
    const points = weightTrend.map((d, i) => ({
      x: padding + i * xStep,
      y: height - padding - (d.weight - minWeight) * yScale,
      weight: d.weight,
      date: d.date
    }))
    
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
    const areaD = `${pathD} L${points[points.length - 1].x},${height - padding} L${padding},${height - padding} Z`
    
    return { path: pathD, areaPath: areaD, points }
  }

  const { path, areaPath, points } = generateTrendPath()

  // 获取星期几
  const getWeekday = (dateStr: string) => {
    const date = new Date(dateStr)
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return weekdays[date.getDay()]
  }

  return (
    <View className="flex flex-col min-h-screen bg-[#F7F4ED]">
      {/* Header */}
      <View className="sticky top-0 z-40 h-14 flex items-center justify-between px-4 bg-[#F7F4ED]">
        <View className="w-10 h-10" />
        <Text className="text-base font-semibold text-[#1E2933]">健康管理</Text>
        <View 
          className="w-10 h-10 flex items-center justify-center relative"
          onClick={handleNotificationClick}
        >
          <Bell size={20} color="#6B7280" />
          {unreadCount > 0 && (
            <View 
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                minWidth: '16px',
                height: '16px',
                borderRadius: '8px',
                backgroundColor: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingLeft: '4px',
                paddingRight: '4px'
              }}
            >
              <Text style={{ fontSize: '10px', color: '#fff', fontWeight: 'bold' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Main Content */}
      <View className="flex-1 overflow-y-auto pb-20">
        {/* 问候语 */}
        <View className="px-4 pt-4 pb-2">
          <Text className="block text-lg font-semibold text-[#4CAF50]">欢迎回来，健康生活每一天！加油！</Text>
        </View>
        
        {/* 今日打卡状态 */}
        <View className="px-4 pt-3 pb-2">
          <Card className="shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
            <CardContent className="p-4 flex items-center justify-between">
              <View className="flex items-center gap-3">
                <View className="w-10 h-10 bg-[#3C8D6E]/15 rounded-full flex items-center justify-center">
                  <CircleCheck size={20} color="#3C8D6E" />
                </View>
                <View>
                  <Text className="block text-sm font-semibold text-[#1E2933]">
                    {metrics?.todayCheckedIn ? '今日已打卡' : '今日未打卡'}
                  </Text>
                  <Text className="block text-xs text-[#6B7280] mt-1">
                    {metrics?.todayCheckedIn ? '坚持就是胜利，继续保持！' : '快去记录今天的体重吧'}
                  </Text>
                </View>
              </View>
              <Button 
                onClick={goToCheckin}
                className="px-4 py-2 bg-[#F26B3A] text-white text-sm font-semibold rounded-lg"
              >
                打卡
              </Button>
            </CardContent>
          </Card>
        </View>

        {/* 健康指标概览 */}
        <View className="px-4 pt-4">
          <View className="flex items-center justify-between mb-3">
            <Text className="text-base font-semibold text-[#1E2933]">健康指标</Text>
            <View onClick={goToData}>
              <Text className="text-xs text-[#F26B3A] font-medium">查看全部</Text>
            </View>
          </View>
          
          <View className="grid grid-cols-2 gap-3">
            {/* 体重卡片 */}
            <Card className="shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
              <CardContent className="p-4">
                <View className="flex items-center gap-2 mb-2">
                  <View className="w-7 h-7 bg-[#F26B3A]/15 rounded-lg flex items-center justify-center">
                    <Scale size={16} color="#F26B3A" />
                  </View>
                  <Text className="text-xs font-medium text-[#6B7280]">体重</Text>
                </View>
                <Text className="block text-2xl font-bold text-[#1E2933]">
                  {metrics?.currentWeight || '--'}
                  <Text className="text-sm font-normal text-[#6B7280] ml-1">kg</Text>
                </Text>
                <View className="mt-2 flex items-center gap-1">
                  <Text className="text-xs text-[#6B7280]">目标 {userInfo?.target_weight || '--'}kg</Text>
                  {metrics && (
                    <Text className="text-xs text-[#F59E0B] font-medium">
                      差 {metrics.weightDiff > 0 ? metrics.weightDiff.toFixed(1) : 0}kg
                    </Text>
                  )}
                </View>
              </CardContent>
            </Card>

            {/* 腰围卡片 */}
            <Card className="shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
              <CardContent className="p-4">
                <View className="flex items-center gap-2 mb-2">
                  <View className="w-7 h-7 bg-[#3C8D6E]/15 rounded-lg flex items-center justify-center">
                    <Ruler size={16} color="#3C8D6E" />
                  </View>
                  <Text className="text-xs font-medium text-[#6B7280]">腰围</Text>
                </View>
                <Text className="block text-2xl font-bold text-[#1E2933]">
                  {metrics?.currentWaist || '--'}
                  <Text className="text-sm font-normal text-[#6B7280] ml-1">cm</Text>
                </Text>
                <View className="mt-2">
                  <View 
                    className="inline-flex items-center px-2 py-1 rounded-full"
                    style={{ backgroundColor: getLevelColor(metrics?.waistLevel || '') + '15' }}
                  >
                    <Text 
                      className="text-xs font-semibold"
                      style={{ color: getLevelColor(metrics?.waistLevel || '') }}
                    >
                      {metrics?.waistLevel || '--'}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* BMI卡片 */}
            <Card className="shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
              <CardContent className="p-4">
                <View className="flex items-center gap-2 mb-2">
                  <View className="w-7 h-7 bg-[#F26B3A]/15 rounded-lg flex items-center justify-center">
                    <Activity size={16} color="#F26B3A" />
                  </View>
                  <Text className="text-xs font-medium text-[#6B7280]">BMI</Text>
                </View>
                <Text className="block text-2xl font-bold text-[#1E2933]">
                  {metrics?.bmi || '--'}
                </Text>
                <View className="mt-2">
                  <View 
                    className="inline-flex items-center px-2 py-1 rounded-full"
                    style={{ backgroundColor: getBmiColor(metrics?.bmiLevel || '') + '15' }}
                  >
                    <Text 
                      className="text-xs font-semibold"
                      style={{ color: getBmiColor(metrics?.bmiLevel || '') }}
                    >
                      {metrics?.bmiLevel || '--'}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* 体脂率卡片 */}
            <Card className="shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
              <CardContent className="p-4">
                <View className="flex items-center gap-2 mb-2">
                  <View className="w-7 h-7 bg-[#F59E0B]/15 rounded-lg flex items-center justify-center">
                    <Percent size={16} color="#F59E0B" />
                  </View>
                  <Text className="text-xs font-medium text-[#6B7280]">体脂率</Text>
                </View>
                <Text className="block text-2xl font-bold text-[#1E2933]">
                  {metrics?.bodyFatRate || '--'}
                  <Text className="text-sm font-normal text-[#6B7280] ml-1">%</Text>
                </Text>
                <View className="mt-2">
                  <View 
                    className="inline-flex items-center px-2 py-1 rounded-full"
                    style={{ backgroundColor: getLevelColor(metrics?.bodyFatLevel || '') + '15' }}
                  >
                    <Text 
                      className="text-xs font-semibold"
                      style={{ color: getLevelColor(metrics?.bodyFatLevel || '') }}
                    >
                      {metrics?.bodyFatLevel || '--'}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* 健康评分卡片 */}
            <Card className="shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
              <CardContent className="p-4">
                <View className="flex items-center gap-2 mb-2">
                  <View className="w-7 h-7 bg-[#EF4444]/15 rounded-lg flex items-center justify-center">
                    <Heart size={16} color="#EF4444" />
                  </View>
                  <Text className="text-xs font-medium text-[#6B7280]">健康评分</Text>
                </View>
                <Text className="block text-2xl font-bold text-[#1E2933]">
                  {metrics?.healthScore || '--'}
                  <Text className="text-sm font-normal text-[#6B7280] ml-1">分</Text>
                </Text>
                <View className="mt-2">
                  <View 
                    className="inline-flex items-center px-2 py-1 rounded-full"
                    style={{ 
                      backgroundColor: (metrics?.healthScore || 0) >= 80 ? '#10B98115' : 
                                       (metrics?.healthScore || 0) >= 60 ? '#F59E0B15' : '#EF444415'
                    }}
                  >
                    <Text 
                      className="text-xs font-semibold"
                      style={{ 
                        color: (metrics?.healthScore || 0) >= 80 ? '#10B981' : 
                               (metrics?.healthScore || 0) >= 60 ? '#F59E0B' : '#EF4444'
                      }}
                    >
                      {(metrics?.healthScore || 0) >= 80 ? '优秀' : 
                       (metrics?.healthScore || 0) >= 60 ? '良好' : '需改善'}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* 身体年龄卡片 */}
            <Card className="shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
              <CardContent className="p-4">
                <View className="flex items-center gap-2 mb-2">
                  <View className="w-7 h-7 bg-[#8B5CF6]/15 rounded-lg flex items-center justify-center">
                    <Clock size={16} color="#8B5CF6" />
                  </View>
                  <Text className="text-xs font-medium text-[#6B7280]">身体年龄</Text>
                </View>
                <Text className="block text-2xl font-bold text-[#1E2933]">
                  {metrics?.bodyAge || '--'}
                  <Text className="text-sm font-normal text-[#6B7280] ml-1">岁</Text>
                </Text>
                <View className="mt-2">
                  <Text className="text-xs text-[#6B7280]">
                    实际年龄 {userInfo?.birth_date ? Math.floor((new Date().getTime() - new Date(userInfo.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : '--'} 岁
                  </Text>
                </View>
              </CardContent>
            </Card>

            {/* 基础代谢率卡片 */}
            <Card className="shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
              <CardContent className="p-4">
                <View className="flex items-center gap-2 mb-2">
                  <View className="w-7 h-7 bg-[#4CAF50]/15 rounded-lg flex items-center justify-center">
                    <Flame size={16} color="#4CAF50" />
                  </View>
                  <Text className="text-xs font-medium text-[#6B7280]">基础代谢率</Text>
                </View>
                <Text className="block text-2xl font-bold text-[#1E2933]">
                  {metrics?.bmr || '--'}
                  <Text className="text-sm font-normal text-[#6B7280] ml-1">kcal</Text>
                </Text>
                <View className="mt-2">
                  <Text className="text-xs text-[#6B7280]">
                    Mifflin-St Jeor 公式
                  </Text>
                </View>
              </CardContent>
            </Card>

            {/* 体型卡片 */}
            <Card className="shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
              <CardContent className="p-4">
                <View className="flex items-center gap-2 mb-2">
                  <View className="w-7 h-7 bg-[#8B5CF6]/15 rounded-lg flex items-center justify-center">
                    <PersonStanding size={16} color="#8B5CF6" />
                  </View>
                  <Text className="text-xs font-medium text-[#6B7280]">体型</Text>
                </View>
                <Text className="block text-2xl font-bold text-[#1E2933]">
                  {metrics?.bodyType || '--'}
                </Text>
                <View className="mt-2">
                  <Text className="text-xs text-[#6B7280]">
                    根据腰围健康等级确定
                  </Text>
                </View>
              </CardContent>
            </Card>
          </View>
        </View>

        {/* 近7天体重趋势 */}
        <View className="px-4 pt-6">
          <View className="flex items-center justify-between mb-3">
            <Text className="text-base font-semibold text-[#1E2933]">体重趋势</Text>
            <Text className="text-xs text-[#6B7280]">近7天</Text>
          </View>
          
          <Card className="shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
            <CardContent className="p-4">
              {trendData?.weightTrend && trendData.weightTrend.length > 0 ? (
                <>
                  {/* SVG 折线图 */}
                  <View className="relative h-32">
                    <svg viewBox="0 0 320 100" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
                      {/* 网格线 */}
                      <line x1="0" y1="25" x2="320" y2="25" stroke="#E4DED2" strokeWidth="1" strokeDasharray="4,4" />
                      <line x1="0" y1="50" x2="320" y2="50" stroke="#E4DED2" strokeWidth="1" strokeDasharray="4,4" />
                      <line x1="0" y1="75" x2="320" y2="75" stroke="#E4DED2" strokeWidth="1" strokeDasharray="4,4" />
                      
                      {/* 渐变定义 */}
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#F26B3A" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#F26B3A" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      
                      {/* 区域填充 */}
                      <path d={areaPath} fill="url(#gradient)" opacity="0.3" />
                      
                      {/* 折线 */}
                      <path d={path} stroke="#F26B3A" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      
                      {/* 数据点 */}
                      {points.map((p, i) => (
                        <circle 
                          key={i} 
                          cx={p.x} 
                          cy={p.y} 
                          r={i === points.length - 1 ? 5 : 4} 
                          fill="#F26B3A"
                          stroke={i === points.length - 1 ? '#fff' : 'none'}
                          strokeWidth={i === points.length - 1 ? 2 : 0}
                        />
                      ))}
                    </svg>
                    
                    {/* 当前值标注 */}
                    {points.length > 0 && (
                      <View 
                        className="absolute right-0 top-0 bg-[#F26B3A] text-white text-xs font-semibold px-2 py-1 rounded-lg"
                      >
                        <Text className="text-white text-xs font-semibold">
                          {points[points.length - 1].weight}kg
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {/* 日期标签 */}
                  <View className="flex justify-between mt-3">
                    {trendData?.weightTrend?.map((d, i) => (
                      <Text 
                        key={i} 
                        className={`text-xs ${i === (trendData?.weightTrend?.length || 0) - 1 ? 'text-[#F26B3A] font-medium' : 'text-[#6B7280]'}`}
                      >
                        {getWeekday(d.date)}
                      </Text>
                    ))}
                  </View>
                </>
              ) : (
                <View className="h-32 flex items-center justify-center">
                  <Text className="text-[#6B7280] text-sm">暂无数据</Text>
                </View>
              )}
            </CardContent>
          </Card>
        </View>

        {/* 快速操作 */}
        <View className="px-4 pt-6 pb-6">
          <Text className="text-base font-semibold text-[#1E2933] mb-3">快速操作</Text>
          
          <View className="grid grid-cols-3 gap-3">
            <Card className="shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
              <CardContent className="p-4 flex flex-col items-center gap-2" onClick={goToCheckin}>
                <View className="w-12 h-12 bg-[#F26B3A]/15 rounded-xl flex items-center justify-center">
                  <CircleCheck size={24} color="#F26B3A" />
                </View>
                <Text className="text-sm font-medium text-[#1E2933]">一键打卡</Text>
              </CardContent>
            </Card>

            <Card className="shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
              <CardContent className="p-4 flex flex-col items-center gap-2" onClick={goToData}>
                <View className="w-12 h-12 bg-[#3C8D6E]/15 rounded-xl flex items-center justify-center">
                  <FileText size={24} color="#3C8D6E" />
                </View>
                <Text className="text-sm font-medium text-[#1E2933]">详细数据</Text>
              </CardContent>
            </Card>

            <Card className="shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
              <CardContent className="p-4 flex flex-col items-center gap-2" onClick={goToProfile}>
                <View className="w-12 h-12 bg-[#F59E0B]/15 rounded-xl flex items-center justify-center">
                  <Target size={24} color="#F59E0B" />
                </View>
                <Text className="text-sm font-medium text-[#1E2933]">设置目标</Text>
              </CardContent>
            </Card>
          </View>
        </View>
      </View>

      {/* 通知列表弹窗 */}
      <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
        <DialogContent className="max-w-[90vw] max-h-[70vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell size={20} color="#F26B3A" />
              <Text className="text-lg font-semibold">消息通知</Text>
            </DialogTitle>
          </DialogHeader>
          
          <View className="flex-1 overflow-y-auto">
            {loadingNotifications ? (
              <View className="flex items-center justify-center py-8">
                <Text className="text-gray-500">加载中...</Text>
              </View>
            ) : notifications.length === 0 ? (
              <View className="flex flex-col items-center justify-center py-8">
                <Bell size={48} color="#D1D5DB" />
                <Text className="text-gray-400 mt-4">暂无通知</Text>
              </View>
            ) : (
              <View className="flex flex-col gap-3">
                {notifications.map((notification) => {
                  const IconComponent = getNotificationIcon(notification.type)
                  const iconColor = getNotificationIconColor(notification.type)
                  
                  return (
                    <View 
                      key={notification.id}
                      className={`flex gap-3 p-3 rounded-xl ${notification.read ? 'bg-gray-50' : 'bg-orange-50'}`}
                      onClick={() => handleNotificationItemClick(notification)}
                    >
                      <View 
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${iconColor}20` }}
                      >
                        <IconComponent size={18} color={iconColor} />
                      </View>
                      <View className="flex-1 min-w-0">
                        <View className="flex items-center justify-between mb-1">
                          <Text className="text-sm font-semibold text-[#1E2933]">{notification.title}</Text>
                          {!notification.read && (
                            <View className="w-2 h-2 bg-red-500 rounded-full" />
                          )}
                        </View>
                        <Text className="text-xs text-gray-500 leading-relaxed">{truncateContent(notification.content)}</Text>
                        <Text className="text-xs text-gray-400 mt-1">{notification.date}</Text>
                      </View>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleCloseNotificationDialog}
            >
              <Text className="text-sm">关闭</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 通知详情弹窗 */}
      <Dialog open={showNotificationDetail} onOpenChange={setShowNotificationDetail}>
        <DialogContent className="max-w-[90vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedNotification && (
                <>
                  {(() => {
                    const IconComponent = getNotificationIcon(selectedNotification.type)
                    const iconColor = getNotificationIconColor(selectedNotification.type)
                    return <IconComponent size={20} color={iconColor} />
                  })()}
                  <Text className="text-lg font-semibold">{selectedNotification.title}</Text>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedNotification && (
            <View className="py-4">
              <Text className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedNotification.content}</Text>
              <Text className="text-xs text-gray-400 mt-4">{selectedNotification.date}</Text>
            </View>
          )}
          
          <DialogFooter>
            <Button 
              className="w-full bg-[#F26B3A]"
              onClick={handleCloseDetail}
            >
              <Text className="text-sm text-white">关闭</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  )
}
