import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { UpdateUserDto } from './dto/update-user.dto'

// 计算健康指标的辅助函数
function calculateHealthMetrics(weight: number, waist: number, height: number, gender: string, age: number) {
  // BMI = 体重 / 身高^2
  const bmi = weight && height ? Math.round((weight / Math.pow(height / 100, 2)) * 10) / 10 : 0

  // 体脂率计算（根据性别）
  let bodyFatRate = 0
  if (weight && height && waist && gender) {
    if (gender === 'male') {
      // 男性体脂率 = (1.2 × BMI) + (0.23 × 年龄) - 16.2
      bodyFatRate = Math.round((1.2 * bmi + 0.23 * age - 16.2) * 10) / 10
    } else {
      // 女性体脂率 = (1.2 × BMI) + (0.23 × 年龄) - 5.4
      bodyFatRate = Math.round((1.2 * bmi + 0.23 * age - 5.4) * 10) / 10
    }
  }

  // 健康等级判定
  let bmiLevel = ''
  if (bmi > 0) {
    if (bmi < 18.5) bmiLevel = '体重过低'
    else if (bmi < 24) bmiLevel = '正常'
    else if (bmi < 28) bmiLevel = '超重'
    else bmiLevel = '肥胖'
  }

  let bodyFatLevel = ''
  if (bodyFatRate > 0) {
    if (gender === 'male') {
      if (bodyFatRate < 10) bodyFatLevel = '偏低'
      else if (bodyFatRate < 20) bodyFatLevel = '正常'
      else if (bodyFatRate < 25) bodyFatLevel = '偏高'
      else bodyFatLevel = '肥胖'
    } else {
      if (bodyFatRate < 18) bodyFatLevel = '偏低'
      else if (bodyFatRate < 28) bodyFatLevel = '正常'
      else if (bodyFatRate < 33) bodyFatLevel = '偏高'
      else bodyFatLevel = '肥胖'
    }
  }

  let waistLevel = ''
  if (waist > 0) {
    if (gender === 'male') {
      if (waist < 85) waistLevel = '正常'
      else if (waist < 90) waistLevel = '中心型肥胖前期'
      else waistLevel = '中心型肥胖'
    } else {
      if (waist < 80) waistLevel = '正常'
      else if (waist < 85) waistLevel = '中心型肥胖前期'
      else waistLevel = '中心型肥胖'
    }
  }

  return { bmi, bmiLevel, bodyFatRate, bodyFatLevel, waistLevel }
}

@Injectable()
export class UserService {
  /**
   * 获取用户信息（按当前登录用户）
   */
  async getUserInfo(userId: string) {
    const client = getSupabaseClient()

    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw new Error(`获取用户信息失败: ${error.message}`)

    return data || null
  }

  /**
   * 更新用户信息（按当前登录用户）
   */
  async updateUserInfo(userId: string, updateUserDto: UpdateUserDto) {
    const client = getSupabaseClient()

    // 查询当前用户
    const { data: currentUser, error: queryError } = await client
      .from('users')
      .select('id, current_weight, current_waist, height, gender, birth_date')
      .eq('id', userId)
      .maybeSingle()

    if (queryError) throw new Error(`查询用户失败: ${queryError.message}`)
    if (!currentUser) throw new Error('用户不存在')

    // 合并更新后的数据
    const updatedGender = updateUserDto.gender || currentUser.gender
    const updatedHeight = updateUserDto.height || currentUser.height
    const updatedBirthDate = updateUserDto.birth_date || currentUser.birth_date
    const currentWeight = currentUser.current_weight
    const currentWaist = currentUser.current_waist

    // 计算年龄
    let age = 30
    if (updatedBirthDate) {
      const birthDate = new Date(updatedBirthDate)
      age = new Date().getFullYear() - birthDate.getFullYear()
    }

    // 如果有体重和腰围数据，重新计算健康指标
    let healthMetrics = {}
    if (currentWeight && currentWaist && updatedHeight) {
      const metrics = calculateHealthMetrics(
        currentWeight,
        currentWaist,
        updatedHeight,
        updatedGender,
        age
      )
      healthMetrics = {
        bmi: metrics.bmi,
        bmi_level: metrics.bmiLevel,
        body_fat_rate: metrics.bodyFatRate,
        body_fat_level: metrics.bodyFatLevel,
        waist_level: metrics.waistLevel
      }
    }

    const { data, error } = await client
      .from('users')
      .update({
        ...updateUserDto,
        ...healthMetrics,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()

    if (error) throw new Error(`更新用户失败: ${error.message}`)
    return data?.[0]
  }

  /**
   * 初始化用户（按当前登录用户）
   */
  async initUser(userId: string, body: { nickname?: string; gender?: string; birth_date?: string; height?: number }) {
    const client = getSupabaseClient()

    // 检查是否已有用户
    const { data: existingUser, error: queryError } = await client
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (queryError) throw new Error(`查询用户失败: ${queryError.message}`)

    if (existingUser) {
      return existingUser
    }

    // 创建新用户（id 交由 Supabase 生成）
    const { data, error } = await client
      .from('users')
      .insert({
        nickname: body.nickname || '用户',
        gender: body.gender || 'male',
        birth_date: body.birth_date || '1990-01-01',
        height: body.height || 170,
        target_weight: 65,
        target_waist: 80
      })
      .select()

    if (error) throw new Error(`初始化用户失败: ${error.message}`)
    return data?.[0]
  }

  /**
   * 提交意见反馈
   */
  async submitFeedback(userId: string, content: string, contact?: string) {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('feedback')
      .insert({
        user_id: userId,
        content,
        contact: contact || null,
      })
      .select()
      .single()

    if (error) throw new Error(`提交反馈失败: ${error.message}`)
    return data
  }
}
