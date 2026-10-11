import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Smartphone, KeyRound, ArrowRight, ShieldCheck } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { setToken, isLoggedIn } from '@/lib/auth'

const PHONE_RE = /^1[3-9]\d{9}$/

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // 已登录则直接进入首页
    if (isLoggedIn()) {
      Taro.switchTab({ url: '/pages/index/index' })
    }
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  async function handleSendCode() {
    if (!PHONE_RE.test(phone)) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    try {
      const res = await Network.request({
        url: '/api/auth/send-code',
        method: 'POST',
        data: { phone },
      })
      const body = res.data
      if (body?.code === 200) {
        Taro.showToast({ title: '验证码已发送', icon: 'success' })
        if (body.data?.devCode) {
          setDevCode(body.data.devCode)
          setCode(body.data.devCode)
        }
        setCountdown(60)
      } else {
        Taro.showToast({ title: body?.msg || '发送失败', icon: 'none' })
      }
    } catch (err) {
      Taro.showToast({ title: '发送失败，请检查网络', icon: 'none' })
    }
  }

  async function handleLogin() {
    if (!PHONE_RE.test(phone)) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (!code) {
      Taro.showToast({ title: '请输入验证码', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/auth/login',
        method: 'POST',
        data: { phone, code },
      })
      const body = res.data
      if (body?.code === 200 && body.data?.token) {
        setToken(body.data.token)
        Taro.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/index/index' })
        }, 800)
      } else {
        Taro.showToast({ title: body?.msg || '登录失败', icon: 'none' })
      }
    } catch (err) {
      Taro.showToast({ title: '登录失败，请检查网络', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex flex-col min-h-screen bg-[#F7F4ED]">
      {/* Header */}
      <View className="flex flex-col items-center pt-16 pb-6 px-6">
        <View className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F26B3A] to-[#3C8D6E] flex items-center justify-center mb-4">
          <ShieldCheck size={32} color="#fff" />
        </View>
        <Text className="text-xl font-bold text-[#1E2933]">欢迎使用体重管理</Text>
        <Text className="text-sm text-[#6B7280] mt-2">手机号登录，跨端同步健康数据</Text>
      </View>

      {/* Login form */}
      <View className="px-4">
        <Card className="bg-white shadow-md">
          <CardContent className="p-5">
            <View className="mb-4">
              <Text className="text-sm font-medium text-[#1E2933] mb-2 block">手机号</Text>
              <View className="flex items-center gap-2 bg-[#F7F4ED] rounded-xl px-4 py-3">
                <Smartphone size={18} color="#6B7280" />
                <Input
                  className="flex-1 bg-transparent"
                  type="number"
                  maxlength={11}
                  placeholder="请输入手机号"
                  value={phone}
                  onInput={(e) => setPhone(e.detail.value)}
                />
              </View>
            </View>

            <View className="mb-5">
              <Text className="text-sm font-medium text-[#1E2933] mb-2 block">验证码</Text>
              <View className="flex items-center gap-2">
                <View className="flex items-center gap-2 bg-[#F7F4ED] rounded-xl px-4 py-3 flex-1">
                  <KeyRound size={18} color="#6B7280" />
                  <Input
                    className="flex-1 bg-transparent"
                    type="number"
                    maxlength={6}
                    placeholder="请输入验证码"
                    value={code}
                    onInput={(e) => setCode(e.detail.value)}
                  />
                </View>
                <View
                  className="px-3 py-3 rounded-xl bg-[#F26B3A]/10"
                  onClick={countdown > 0 ? undefined : handleSendCode}
                >
                  <Text className="text-sm font-medium text-[#F26B3A]">
                    {countdown > 0 ? `${countdown}s` : '获取验证码'}
                  </Text>
                </View>
              </View>
            </View>

            {devCode && (
              <View className="mb-5 flex items-center justify-center gap-1">
                <Text className="text-xs text-[#6B7280]">开发模式验证码：</Text>
                <Text className="text-xs font-semibold text-[#F26B3A]">{devCode}</Text>
              </View>
            )}

            <Button
              className="w-full py-3 bg-[#F26B3A] text-white font-semibold rounded-xl flex items-center justify-center gap-2"
              onClick={handleLogin}
              disabled={loading}
            >
              <Text className="text-white font-semibold">{loading ? '登录中...' : '登录'}</Text>
              {!loading && <ArrowRight size={18} color="#fff" />}
            </Button>
          </CardContent>
        </Card>
      </View>

      <View className="mt-auto py-8 text-center">
        <Text className="text-xs text-[#6B7280]">登录即代表同意《用户协议》与《隐私政策》</Text>
      </View>
    </View>
  )
}
