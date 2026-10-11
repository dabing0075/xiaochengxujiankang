import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { User, Target, Calendar, Download, Info, MessageSquare, Trash2, ChevronRight, Settings, Pencil } from 'lucide-react-taro'
import { Card, CardContent } from '@/components/ui/card'
import { Network } from '@/network'
import { clearToken } from '@/lib/auth'

interface UserInfo {
  id: string
  nickname: string
  gender: string
  birth_date: string
  height: number
  target_weight: number
  target_waist: number
  // 健康指标
  current_weight?: number
  current_waist?: number
  bmi?: number
  bmi_level?: string
  body_fat_rate?: number
  body_fat_level?: string
  waist_level?: string
  last_checkin_date?: string
}

interface CheckinStats {
  totalDays: number
  continuousDays: number
  monthDays: number
}

export default function ProfilePage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [checkinStats, setCheckinStats] = useState<CheckinStats>({
    totalDays: 0,
    continuousDays: 0,
    monthDays: 0
  })
  const [cacheSize] = useState('12.5 MB')

  async function fetchUserInfo() {
    try {
      const res = await Network.request({
        url: '/api/user/info',
        method: 'GET'
      })
      console.log('User info response:', res.data)
      if (res.data?.code === 200 && res.data?.data) {
        setUserInfo(res.data.data)
      }
    } catch (error) {
      console.error('Fetch user info error:', error)
    }
  }

  async function fetchCheckinStats() {
    try {
      const res = await Network.request({
        url: '/api/records/stats',
        method: 'GET'
      })
      console.log('Checkin stats response:', res.data)
      if (res.data?.code === 200 && res.data?.data) {
        setCheckinStats(res.data.data)
      }
    } catch (error) {
      console.error('Fetch checkin stats error:', error)
    }
  }

  useEffect(() => {
    fetchUserInfo()
    fetchCheckinStats()
    
    // 监听打卡成功事件，刷新数据
    const handleCheckinSuccess = () => {
      console.log('我的页收到打卡成功事件，刷新数据')
      fetchUserInfo()
      fetchCheckinStats()
    }
    Taro.eventCenter.on('checkinSuccess', handleCheckinSuccess)
    
    return () => {
      Taro.eventCenter.off('checkinSuccess', handleCheckinSuccess)
    }
  }, [])

  // 每次进入页面时刷新数据（打卡后数据变化）
  useDidShow(() => {
    fetchUserInfo()
    fetchCheckinStats()
  })

  function getGenderText(gender: string) {
    return gender === 'male' ? '男' : gender === 'female' ? '女' : '未设置'
  }

  function calculateAge(birthDate: string) {
    if (!birthDate) return '-'
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  function handleEditProfile() {
    Taro.navigateTo({ url: '/pages/edit-profile/index' })
  }

  function handleEditTarget() {
    Taro.navigateTo({ url: '/pages/edit-target/index' })
  }

  function handleMenuClick(type: string) {
    switch (type) {
      case 'records':
        Taro.switchTab({ url: '/pages/data/index' })
        break
      case 'export':
        handleExportData()
        break
      case 'about':
        Taro.showModal({
          title: '关于我们',
          content: '体重管理助手 v1.0.0\n\n帮助你科学管理体重，记录健康数据，分析趋势变化。',
          showCancel: false
        })
        break
      case 'feedback':
        Taro.navigateTo({ url: '/pages/feedback/index' })
        break
      case 'cache':
        Taro.showModal({
          title: '清除缓存',
          content: `当前缓存大小: ${cacheSize}\n确定要清除吗？`,
          success: (res) => {
            if (res.confirm) {
              Taro.showToast({ title: '清除成功', icon: 'success' })
            }
          }
        })
        break
      default:
        break
    }
  }

  async function handleExportData() {
    try {
      Taro.showLoading({ title: '导出中...' })
      const res = await Network.request({
        url: '/api/records/export',
        method: 'GET'
      })
      Taro.hideLoading()
      
      if (res.data?.code === 200 && res.data?.data) {
        const records = res.data.data
        if (!records || records.length === 0) {
          Taro.showToast({ title: '暂无数据可导出', icon: 'none' })
          return
        }
        
        // 格式化数据为文本
        let exportText = '日期,体重(kg),腰围(cm),备注\n'
        records.forEach((r: any) => {
          exportText += `${r.record_date},${r.weight},${r.waist || ''},${r.note || ''}\n`
        })
        
        // 复制到剪贴板
        await Taro.setClipboardData({
          data: exportText
        })
        
        Taro.showModal({
          title: '导出成功',
          content: `已导出 ${records.length} 条记录到剪贴板，可粘贴到Excel或其他应用中。`,
          showCancel: false
        })
      } else {
        Taro.showToast({ title: '导出失败', icon: 'none' })
      }
    } catch (error) {
      Taro.hideLoading()
      console.error('Export error:', error)
      Taro.showToast({ title: '导出失败', icon: 'none' })
    }
  }

  function handleSettings() {
    Taro.showActionSheet({
      itemList: ['清除缓存', '关于我们', '退出登录'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            // 清除缓存
            Taro.showModal({
              title: '清除缓存',
              content: `当前缓存大小: ${cacheSize}\n确定要清除吗？`,
              success: (modalRes) => {
                if (modalRes.confirm) {
                  Taro.showToast({ title: '清除成功', icon: 'success' })
                }
              }
            })
            break
          case 1:
            // 关于我们
            Taro.showModal({
              title: '关于我们',
              content: '体重管理助手 v1.0.0\n\n帮助你科学管理体重，记录健康数据，分析趋势变化。\n\n© 2024 体重管理团队',
              showCancel: false
            })
            break
          case 2:
            // 退出登录
            Taro.showModal({
              title: '退出登录',
              content: '确定要退出登录吗？',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  clearToken()
                  Taro.reLaunch({ url: '/pages/login/index' })
                }
              }
            })
            break
        }
      }
    })
  }

  return (
    <View className="flex flex-col min-h-screen bg-[#F7F4ED]">
      {/* Header */}
      <View className="sticky top-0 z-40 h-14 flex items-center justify-between px-4 bg-[#F7F4ED]">
        <View className="w-10 h-10" />
        <Text className="text-base font-semibold text-[#1E2933]">个人中心</Text>
        <View 
          className="w-10 h-10 flex items-center justify-center rounded-full"
          onClick={handleSettings}
        >
          <Settings size={20} color="#6B7280" />
        </View>
      </View>

      {/* Content */}
      <ScrollView scrollY className="flex-1 pb-20">
        {/* 用户头像和昵称 */}
        <View className="px-4 py-6">
          <View className="flex items-center gap-4">
            <View className="w-16 h-16 rounded-full bg-gradient-to-br from-[#F26B3A] to-[#3C8D6E] flex items-center justify-center">
              <Text className="text-2xl font-bold text-white">
                {userInfo?.nickname?.[0] || '初'}
              </Text>
            </View>
            <View className="flex-1 min-w-0 flex flex-col">
              <Text className="block text-lg font-semibold text-[#1E2933] truncate">
                {userInfo?.nickname || '未设置昵称'}
              </Text>
              <Text className="block text-sm text-[#6B7280] mt-1">
                坚持打卡，健康生活
              </Text>
            </View>
            <View 
              className="w-10 h-10 rounded-full bg-[#F0EDE6] flex items-center justify-center"
              onClick={handleEditProfile}
            >
              <Pencil size={18} color="#6B7280" />
            </View>
          </View>
        </View>

        {/* 个人信息卡片 */}
        <View className="px-4">
          <Card className="bg-white shadow-md">
            <CardContent className="p-4">
              <View className="flex items-center justify-between mb-3">
                <View className="flex items-center gap-2">
                  <User size={16} color="#F26B3A" />
                  <Text className="text-base font-semibold text-[#1E2933]">个人信息</Text>
                </View>
                <View 
                  className="px-2 py-1 rounded-md bg-[#F0EDE6]"
                  onClick={handleEditProfile}
                >
                  <Text className="text-xs text-[#F26B3A]">编辑</Text>
                </View>
              </View>

              <View className="grid grid-cols-2 gap-3">
                <View className="bg-[#F7F4ED] rounded-xl p-3">
                  <Text className="text-xs text-[#6B7280] mb-1 block">姓名</Text>
                  <Text className="text-sm font-medium text-[#1E2933]">
                    {userInfo?.nickname || '-'}
                  </Text>
                </View>
                <View className="bg-[#F7F4ED] rounded-xl p-3">
                  <Text className="text-xs text-[#6B7280] mb-1 block">性别</Text>
                  <Text className="text-sm font-medium text-[#1E2933]">
                    {getGenderText(userInfo?.gender || '')}
                  </Text>
                </View>
                <View className="bg-[#F7F4ED] rounded-xl p-3">
                  <Text className="text-xs text-[#6B7280] mb-1 block">年龄</Text>
                  <Text className="text-sm font-medium text-[#1E2933]">
                    {calculateAge(userInfo?.birth_date || '')} 岁
                  </Text>
                </View>
                <View className="bg-[#F7F4ED] rounded-xl p-3">
                  <Text className="text-xs text-[#6B7280] mb-1 block">身高</Text>
                  <Text className="text-sm font-medium text-[#1E2933]">
                    {userInfo?.height || '-'} cm
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>
        </View>

        {/* 打卡记录卡片 */}
        <View className="px-4 pt-4">
          <Card className="bg-white shadow-md">
            <CardContent className="p-4">
              <View className="flex items-center gap-2 mb-3">
                <Calendar size={16} color="#F26B3A" />
                <Text className="text-base font-semibold text-[#1E2933]">打卡记录</Text>
              </View>

              <View className="grid grid-cols-3 gap-3">
                <View className="text-center bg-[#F7F4ED] rounded-xl p-3">
                  <Text className="text-2xl font-bold text-[#F26B3A]">
                    {checkinStats.totalDays}
                  </Text>
                  <Text className="text-xs text-[#6B7280] mt-1 block">总打卡天数</Text>
                </View>
                <View className="text-center bg-[#F7F4ED] rounded-xl p-3">
                  <Text className="text-2xl font-bold text-[#3C8D6E]">
                    {checkinStats.continuousDays}
                  </Text>
                  <Text className="text-xs text-[#6B7280] mt-1 block">连续打卡</Text>
                </View>
                <View className="text-center bg-[#F7F4ED] rounded-xl p-3">
                  <Text className="text-2xl font-bold text-[#6366F1]">
                    {checkinStats.monthDays}
                  </Text>
                  <Text className="text-xs text-[#6B7280] mt-1 block">本月打卡</Text>
                </View>
              </View>

              <View 
                className="mt-3 flex items-center justify-center gap-1 py-2 rounded-lg bg-[#F0EDE6]"
                onClick={() => handleMenuClick('records')}
              >
                <Text className="text-sm text-[#F26B3A]">查看全部记录</Text>
                <ChevronRight size={16} color="#F26B3A" />
              </View>
            </CardContent>
          </Card>
        </View>

        {/* 健康目标设置卡片 */}
        <View className="px-4 pt-4">
          <Card className="bg-white shadow-md">
            <CardContent className="p-4" onClick={handleEditTarget}>
              <View className="flex items-center justify-between mb-3">
                <View className="flex items-center gap-2">
                  <Target size={16} color="#F26B3A" />
                  <Text className="text-base font-semibold text-[#1E2933]">健康目标</Text>
                </View>
                <View className="px-2 py-1 rounded-md bg-[#F0EDE6]">
                  <Text className="text-xs text-[#F26B3A]">编辑</Text>
                </View>
              </View>

              <View className="space-y-3">
                <View className="flex items-center justify-between py-2 border-b border-[#E4DED2]">
                  <Text className="text-sm text-[#6B7280]">目标体重</Text>
                  <Text className="text-sm font-medium text-[#1E2933]">
                    {userInfo?.target_weight || '-'} kg
                  </Text>
                </View>
                <View className="flex items-center justify-between py-2 border-b border-[#E4DED2]">
                  <Text className="text-sm text-[#6B7280]">目标腰围</Text>
                  <Text className="text-sm font-medium text-[#1E2933]">
                    {userInfo?.target_waist || '-'} cm
                  </Text>
                </View>
                <View className="flex items-center justify-between py-2">
                  <Text className="text-sm text-[#6B7280]">提醒时间</Text>
                  <Text className="text-sm font-medium text-[#1E2933]">每日 08:00</Text>
                </View>
              </View>
            </CardContent>
          </Card>
        </View>

        {/* 其他功能入口 */}
        <View className="px-4 pt-4">
          <Card className="bg-white shadow-md">
            <CardContent className="p-0">
              <View 
                className="flex items-center justify-between px-4 py-4 border-b border-[#E4DED2]"
                onClick={() => handleMenuClick('export')}
              >
                <View className="flex items-center gap-3">
                  <Download size={18} color="#6B7280" />
                  <Text className="text-sm text-[#1E2933]">数据导出</Text>
                </View>
                <ChevronRight size={18} color="#6B7280" />
              </View>

              <View 
                className="flex items-center justify-between px-4 py-4 border-b border-[#E4DED2]"
                onClick={() => handleMenuClick('about')}
              >
                <View className="flex items-center gap-3">
                  <Info size={18} color="#6B7280" />
                  <Text className="text-sm text-[#1E2933]">关于我们</Text>
                </View>
                <View className="flex items-center gap-2">
                  <Text className="text-xs text-[#6B7280]">v1.0.0</Text>
                  <ChevronRight size={18} color="#6B7280" />
                </View>
              </View>

              <View 
                className="flex items-center justify-between px-4 py-4 border-b border-[#E4DED2]"
                onClick={() => handleMenuClick('feedback')}
              >
                <View className="flex items-center gap-3">
                  <MessageSquare size={18} color="#6B7280" />
                  <Text className="text-sm text-[#1E2933]">意见反馈</Text>
                </View>
                <ChevronRight size={18} color="#6B7280" />
              </View>

              <View 
                className="flex items-center justify-between px-4 py-4"
                onClick={() => handleMenuClick('cache')}
              >
                <View className="flex items-center gap-3">
                  <Trash2 size={18} color="#6B7280" />
                  <Text className="text-sm text-[#1E2933]">清除缓存</Text>
                </View>
                <View className="flex items-center gap-2">
                  <Text className="text-xs text-[#6B7280]">{cacheSize}</Text>
                  <ChevronRight size={18} color="#6B7280" />
                </View>
              </View>
            </CardContent>
          </Card>
        </View>

        {/* 版本信息 */}
        <View className="py-6 text-center">
          <Text className="text-xs text-[#6B7280]">体重管理助手 v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  )
}
