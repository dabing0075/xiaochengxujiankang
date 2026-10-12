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
  const [wechatLoading, setWechatLoading] = useState(false)

  // 绑定手机号流程（微信登录后）
  const [needBindPhone, setNeedBindPhone] = useState(false)
  const [bindPhone, setBindPhone] = useState('')
  const [bindCode, setBindCode] = useState('')
  const [bindDevCode, setBindDevCode] = useState('')
  const [bindCountdown, setBindCountdown] = useState(0)
  const [bindLoading, setBindLoading] = useState(false)

  useEffect(() => {
    // 已登录则直接进入首页
    if (isLoggedIn()) {
      Taro.switchTab({ url: '/pages/index/index' })
      return
    }
    // 检测微信授权：已绑定微信的老用户静默自动登录
    detectWechatAuth()
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  useEffect(() => {
    if (bindCountdown <= 0) return
    const timer = setTimeout(() => setBindCountdown(bindCountdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [bindCountdown])

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

  // 微信一键登录
  async function handleWechatLogin() {
    if (wechatLoading) return
    setWechatLoading(true)
    try {
      if (TARO_ENV !== 'weapp') {
        Taro.showToast({ title: '请在微信小程序中使用', icon: 'none' })
        return
      }
      const loginRes = await Taro.login()
      if (!loginRes.code) {
        Taro.showToast({ title: '获取微信登录态失败', icon: 'none' })
        return
      }

      // 尝试获取头像昵称（用户可能拒绝，拒绝仍可登录）
      let profile: { nickname?: string; avatarUrl?: string } | undefined
      try {
        const profRes = await Taro.getUserProfile({ desc: '用于完善会员资料' })
        profile = {
          nickname: profRes.userInfo?.nickName,
          avatarUrl: profRes.userInfo?.avatarUrl,
        }
      } catch (e) {
        // 忽略：用户拒绝授权头像昵称
      }

      const res = await Network.request({
        url: '/api/auth/wechat-login',
        method: 'POST',
        data: { code: loginRes.code, ...profile },
      })
      const body = res.data
      if (body?.code === 200 && body.data?.token) {
        afterWechatLogin(body.data)
      } else {
        Taro.showToast({ title: body?.msg || '微信登录失败', icon: 'none' })
      }
    } catch (err) {
      Taro.showToast({ title: '微信登录失败，请重试', icon: 'none' })
    } finally {
      setWechatLoading(false)
    }
  }

  // 检测微信授权：已绑定微信的老用户静默自动登录（新用户不创建账号）
  async function detectWechatAuth() {
    if (TARO_ENV !== 'weapp') return
    try {
      const loginRes = await Taro.login()
      if (!loginRes.code) return
      const res = await Network.request({
        url: '/api/auth/wechat-login',
        method: 'POST',
        data: { code: loginRes.code, silent: true },
      })
      const body = res.data
      if (body?.code === 200 && body.data?.token) {
        afterWechatLogin(body.data)
      }
    } catch (e) {
      // 静默检测失败，忽略
    }
  }

  // 微信登录成功后：已绑定手机号则直接进入首页，否则进入绑定手机号流程
  function afterWechatLogin(data: { token: string; user?: { phone?: string } }) {
    setToken(data.token)
    if (data.user?.phone) {
      Taro.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/index/index' })
      }, 800)
    } else {
      // 检测到未绑定手机号：进入绑定流程
      setNeedBindPhone(true)
      Taro.showToast({ title: '请绑定手机号以同步数据', icon: 'none' })
    }
  }

  async function handleBindSendCode() {
    if (!PHONE_RE.test(bindPhone)) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    try {
      const res = await Network.request({
        url: '/api/auth/send-code',
        method: 'POST',
        data: { phone: bindPhone },
      })
      const body = res.data
      if (body?.code === 200) {
        Taro.showToast({ title: '验证码已发送', icon: 'success' })
        if (body.data?.devCode) {
          setBindDevCode(body.data.devCode)
          setBindCode(body.data.devCode)
        }
        setBindCountdown(60)
      } else {
        Taro.showToast({ title: body?.msg || '发送失败', icon: 'none' })
      }
    } catch (err) {
      Taro.showToast({ title: '发送失败，请检查网络', icon: 'none' })
    }
  }

  async function handleBindPhone() {
    if (!PHONE_RE.test(bindPhone)) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (!bindCode) {
      Taro.showToast({ title: '请输入验证码', icon: 'none' })
      return
    }
    setBindLoading(true)
    try {
      const res = await Network.request({
        url: '/api/auth/bind-phone',
        method: 'POST',
        data: { phone: bindPhone, code: bindCode },
      })
      const body = res.data
      if (body?.code === 200 && body.data?.token) {
        setToken(body.data.token)
        Taro.showToast({ title: '绑定成功', icon: 'success' })
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/index/index' })
        }, 800)
      } else {
        Taro.showToast({ title: body?.msg || '绑定失败', icon: 'none' })
      }
    } catch (err) {
      Taro.showToast({ title: '绑定失败，请重试', icon: 'none' })
    } finally {
      setBindLoading(false)
    }
  }

  return (
    <View className="flex flex-col min-h-screen bg-[#F7F4ED]">
      {/* Header */}
      <View className="flex flex-col items-center pt-16 pb-6 px-6">
        <View className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F26B3A] to-[#3C8D6E] flex items-center justify-center mb-4">
          <ShieldCheck size={32} color="#fff" />
        </View>
        <Text className="text-xl font-bold text-[#1E2933]">
          {needBindPhone ? '绑定手机号' : '欢迎使用体重管理'}
        </Text>
        <Text className="text-sm text-[#6B7280] mt-2">
          {needBindPhone ? '绑定后可与 App 同步健康数据' : '手机号登录，跨端同步健康数据'}
        </Text>
      </View>

      {/* 绑定手机号流程 */}
      {needBindPhone ? (
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
                    value={bindPhone}
                    onInput={(e) => setBindPhone(e.detail.value)}
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
                      value={bindCode}
                      onInput={(e) => setBindCode(e.detail.value)}
                    />
                  </View>
                  <View
                    className="px-3 py-3 rounded-xl bg-[#F26B3A]/10"
                    onClick={bindCountdown > 0 ? undefined : handleBindSendCode}
                  >
                    <Text className="text-sm font-medium text-[#F26B3A]">
                      {bindCountdown > 0 ? `${bindCountdown}s` : '获取验证码'}
                    </Text>
                  </View>
                </View>
              </View>

              {bindDevCode && (
                <View className="mb-5 flex items-center justify-center gap-1">
                  <Text className="text-xs text-[#6B7280]">开发模式验证码：</Text>
                  <Text className="text-xs font-semibold text-[#F26B3A]">{bindDevCode}</Text>
                </View>
              )}

              <Button
                className="w-full py-3 bg-[#F26B3A] text-white font-semibold rounded-xl flex items-center justify-center gap-2"
                onClick={handleBindPhone}
                disabled={bindLoading}
              >
                <Text className="text-white font-semibold">{bindLoading ? '绑定中...' : '确认绑定'}</Text>
                {!bindLoading && <ArrowRight size={18} color="#fff" />}
              </Button>

              <View className="mt-4 text-center" onClick={() => setNeedBindPhone(false)}>
                <Text className="text-sm text-[#6B7280]">更换登录方式</Text>
              </View>
            </CardContent>
          </Card>
        </View>
      ) : (
        /* 登录表单 */
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

              <View className="flex items-center gap-3 my-4">
                <View className="flex-1 h-px bg-[#E5E7EB]" />
                <Text className="text-xs text-[#9CA3AF]">或</Text>
                <View className="flex-1 h-px bg-[#E5E7EB]" />
              </View>

              <Button
                className="w-full py-3 bg-[#07C160] text-white font-semibold rounded-xl flex items-center justify-center gap-2"
                onClick={handleWechatLogin}
                disabled={wechatLoading}
              >
                <Text className="text-white font-semibold">
                  {wechatLoading ? '登录中...' : '微信一键登录'}
                </Text>
              </Button>
            </CardContent>
          </Card>
        </View>
      )}

      <View className="mt-auto py-8 text-center">
        <Text className="text-xs text-[#6B7280]">登录即代表同意《用户协议》与《隐私政策》</Text>
      </View>
    </View>
  )
}
