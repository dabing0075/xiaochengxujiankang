import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class HealthService {
  /**
   * 获取健康指标
   * 始终从最新的打卡记录计算BMI和体脂率，确保数据一致性
   */
  async getHealthMetrics(userId: string) {
    const client = getSupabaseClient()

    // 获取当前登录用户
    const { data: users, error: userError } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (userError) throw new Error(`获取用户信息失败: ${userError.message}`)

    const user = users
    if (!user) {
      // 如果没有用户，返回默认值
      return {
        currentWeight: null,
        currentWaist: null,
        bmi: null,
        bmiLevel: '--',
        bodyFatRate: null,
        bodyFatLevel: '--',
        waistLevel: '--',
        weightDiff: 0,
        todayCheckedIn: false
      }
    }

    // 检查今天是否已打卡
    const today = new Date().toISOString().split('T')[0]
    const { data: todayRecords, error: todayError } = await client
      .from('weight_records')
      .select('id')
      .eq('user_id', userId)
      .eq('record_date', today)
      .limit(1)
    
    if (todayError) throw new Error(`检查打卡状态失败: ${todayError.message}`)
    
    const todayCheckedIn = todayRecords && todayRecords.length > 0

    // 从最新打卡记录计算健康指标，确保与 getHealthStats 数据一致
    const { data: records, error: recordError } = await client
      .from('weight_records')
      .select('*')
      .eq('user_id', userId)
      .order('record_date', { ascending: false })
      .limit(1)
    
    if (recordError) throw new Error(`获取记录失败: ${recordError.message}`)
    
    const latestRecord = records?.[0]
    
    // 如果没有记录，返回默认值
    if (!latestRecord) {
      return {
        currentWeight: null,
        currentWaist: null,
        bmi: null,
        bmiLevel: '--',
        bodyFatRate: null,
        bodyFatLevel: '--',
        waistLevel: '--',
        weightDiff: 0,
        todayCheckedIn
      }
    }

    // 计算 BMI（与 getHealthStats 使用相同的计算方式）
    const currentBmi = user.height 
      ? parseFloat((latestRecord.weight / Math.pow(user.height / 100, 2)).toFixed(1)) 
      : 0
    const bmiLevel = this.getBmiLevel(currentBmi)

    // 计算体脂率（与 getHealthStats 使用相同的计算方式）
    const bodyFatRate = this.calculateBodyFat(
      latestRecord.weight,
      user.height,
      user.gender,
      this.calculateAge(user.birth_date)
    )
    const bodyFatLevel = this.getBodyFatLevel(bodyFatRate, user.gender)
    
    // 计算腰围健康等级
    const waistLevel = this.getWaistLevel(latestRecord.waist, user.gender)

    // 计算距离目标的差值
    const weightDiff = user.target_weight 
      ? latestRecord.weight - user.target_weight 
      : 0

    // 计算健康评分和身体年龄
    const age = this.calculateAge(user.birth_date)
    const height = user.height
    const gender = user.gender
    const weight = latestRecord.weight
    const waist = latestRecord.waist

    // 计算身体成分（用于身体年龄和健康评分）
    const fatMass = parseFloat((weight * bodyFatRate / 100).toFixed(1))
    const leanBodyMass = parseFloat((weight - fatMass).toFixed(1))
    const boneMass = parseFloat((weight * 0.13).toFixed(1))
    const muscleMass = parseFloat((leanBodyMass - boneMass).toFixed(1))
    const skeletalMuscle = parseFloat((muscleMass * 0.714).toFixed(1))
    const muscleRate = (skeletalMuscle / weight) * 100
    
    // 内脏脂肪指数
    let vfi = 0
    if (waist) {
      vfi = Math.round(waist / 10 * (currentBmi / 22))
    } else {
      vfi = Math.round(currentBmi * 0.5)
    }

    // 身体年龄计算
    let bmiAge = age
    if (currentBmi >= 18.5 && currentBmi < 24) {
      bmiAge = age
    } else if (currentBmi >= 24 && currentBmi < 28) {
      bmiAge = age + 5
    } else if (currentBmi >= 28) {
      bmiAge = age + 10
    } else {
      bmiAge = age + 3
    }

    let waistAge = age
    if (waist) {
      if (gender === 'male') {
        if (waist < 85) waistAge = age
        else if (waist < 90) waistAge = age + 5
        else waistAge = age + 10
      } else {
        if (waist < 80) waistAge = age
        else if (waist < 85) waistAge = age + 5
        else waistAge = age + 10
      }
    }

    let muscleAge = age
    if (gender === 'male') {
      if (muscleRate >= 33) muscleAge = age - 5
      else if (muscleRate >= 28) muscleAge = age
      else muscleAge = age + 5
    } else {
      if (muscleRate >= 27) muscleAge = age - 5
      else if (muscleRate >= 22) muscleAge = age
      else muscleAge = age + 5
    }

    const baseBodyAge = 0.6 * age + 0.4 * bmiAge + 0.3 * waistAge - 0.3 * muscleAge
    const standardBodyFatRate = gender === 'male' ? 17.5 : 22.5
    const standardMuscleRate = gender === 'male' ? 33 : 27
    const advancedBodyAge = age + (vfi - 9) * 2 + (bodyFatRate - standardBodyFatRate) * 1 - (muscleRate - standardMuscleRate) * 1
    const bodyAge = Math.round(baseBodyAge * 0.4 + advancedBodyAge * 0.6)

    // 健康评分计算
    let bmiScore = 0
    if (currentBmi >= 18.5 && currentBmi < 24) {
      bmiScore = 20
    } else if (currentBmi >= 24 && currentBmi < 28) {
      bmiScore = 14
    } else {
      bmiScore = 6
    }

    let waistScore = 0
    if (waist) {
      if (gender === 'male') {
        if (waist < 85) waistScore = 20
        else if (waist < 90) waistScore = 12
        else waistScore = 5
      } else {
        if (waist < 80) waistScore = 20
        else if (waist < 85) waistScore = 12
        else waistScore = 5
      }
    } else {
      waistScore = 10
    }

    let bodyFatScore = 0
    if (gender === 'male') {
      if (bodyFatRate >= 15 && bodyFatRate <= 22) {
        bodyFatScore = 20
      } else if (bodyFatRate >= 23 && bodyFatRate <= 27) {
        bodyFatScore = 13
      } else if (bodyFatRate < 12 || bodyFatRate > 27) {
        bodyFatScore = 6
      } else {
        bodyFatScore = 13
      }
    } else {
      if (bodyFatRate >= 20 && bodyFatRate <= 28) {
        bodyFatScore = 20
      } else if (bodyFatRate >= 29 && bodyFatRate <= 33) {
        bodyFatScore = 13
      } else if (bodyFatRate < 17 || bodyFatRate > 33) {
        bodyFatScore = 6
      } else {
        bodyFatScore = 13
      }
    }

    let muscleScore = 0
    if (gender === 'male') {
      if (muscleRate >= 35) muscleScore = 20
      else if (muscleRate >= 32) muscleScore = 14
      else muscleScore = 7
    } else {
      if (muscleRate >= 30) muscleScore = 20
      else if (muscleRate >= 27) muscleScore = 14
      else muscleScore = 7
    }

    let ageDiffScore = 0
    const ageDiff = bodyAge - age
    if (ageDiff < 0) {
      ageDiffScore = 20
    } else if (ageDiff === 0) {
      ageDiffScore = 15
    } else if (ageDiff <= 3) {
      ageDiffScore = 10
    } else {
      ageDiffScore = 4
    }

    const healthScore = bmiScore + waistScore + bodyFatScore + muscleScore + ageDiffScore

    // 计算基础代谢率 BMR（Mifflin-St Jeor公式）
    let bmr = 0
    if (gender === 'male') {
      bmr = Math.round(10 * weight + 6.25 * height - 5 * age + 5)
    } else {
      bmr = Math.round(10 * weight + 6.25 * height - 5 * age - 161)
    }

    // 计算体型（根据腰围健康等级）
    let bodyType = '标准型'
    if (latestRecord.waist) {
      const waist = latestRecord.waist
      if (gender === 'male') {
        if (waist >= 90) bodyType = '肥胖型'
        else if (waist >= 85) bodyType = '偏胖型'
        else bodyType = '标准型'
      } else {
        if (waist >= 85) bodyType = '肥胖型'
        else if (waist >= 80) bodyType = '偏胖型'
        else bodyType = '标准型'
      }
    }

    return {
      currentWeight: latestRecord.weight,
      currentWaist: latestRecord.waist,
      bmi: currentBmi,
      bmiLevel,
      bodyFatRate,
      bodyFatLevel,
      waistLevel,
      weightDiff,
      todayCheckedIn,
      gender: user.gender,
      healthScore,
      bodyAge,
      bmr,
      bodyType
    }
  }

  /**
   * 获取趋势数据（体重 + 腰围）
   * @param days 天数
   */
  async getTrendData(userId: string, days: number) {
    const client = getSupabaseClient()
    
    // 计算起始日期
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days + 1)
    
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]
    
    console.log(`[HealthService] 查询趋势数据: ${startDateStr} 至 ${endDateStr}`)
    
    // 查询记录
    const { data: records, error } = await client
      .from('weight_records')
      .select('record_date, weight, waist')
      .eq('user_id', userId)
      .gte('record_date', startDateStr)
      .lte('record_date', endDateStr)
      .order('record_date', { ascending: true })
    
    if (error) throw new Error(`获取趋势数据失败: ${error.message}`)
    
    // 构建趋势数据
    const weightTrend: { date: string; weight: number }[] = []
    const waistTrend: { date: string; waist: number }[] = []
    const currentDate = new Date(startDate)
    
    // 如果没有数据，返回空数组
    if (!records || records.length === 0) {
      return {
        weightTrend: [],
        waistTrend: [],
        weightStats: { start: 0, end: 0, change: 0, changePercent: 0 },
        waistStats: { start: 0, end: 0, change: 0, changePercent: 0 }
      }
    }
    
    // 填充数据，对于缺失的日期使用最近的数据
    let lastWeight = records[0]?.weight || 0
    let lastWaist = records[0]?.waist || 0
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const record = records?.find(r => r.record_date === dateStr)
      
      if (record) {
        lastWeight = record.weight || lastWeight
        lastWaist = record.waist || lastWaist
      }
      
      weightTrend.push({
        date: dateStr,
        weight: lastWeight
      })
      
      waistTrend.push({
        date: dateStr,
        waist: lastWaist
      })
      
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    // 计算统计数据
    const validWeights = weightTrend.filter(d => d.weight > 0).map(d => d.weight)
    const validWaists = waistTrend.filter(d => d.waist > 0).map(d => d.waist)
    
    const weightStats = {
      start: validWeights[0] || 0,
      end: validWeights[validWeights.length - 1] || 0,
      change: 0,
      changePercent: 0
    }
    
    if (validWeights.length >= 2) {
      weightStats.change = weightStats.end - weightStats.start
      weightStats.changePercent = parseFloat(((weightStats.change / weightStats.start) * 100).toFixed(1))
    }
    
    const waistStats = {
      start: validWaists[0] || 0,
      end: validWaists[validWaists.length - 1] || 0,
      change: 0,
      changePercent: 0
    }
    
    if (validWaists.length >= 2) {
      waistStats.change = waistStats.end - waistStats.start
      waistStats.changePercent = parseFloat(((waistStats.change / waistStats.start) * 100).toFixed(1))
    }
    
    return {
      weightTrend,
      waistTrend,
      weightStats,
      waistStats
    }
  }

  /**
   * 获取 BMI 等级（根据文档标准）
   */
  private getBmiLevel(bmi: number): string {
    if (bmi < 18.5) return '体重过低'
    if (bmi < 24) return '正常'
    if (bmi < 28) return '超重'
    return '肥胖'
  }

  /**
   * 获取腰围健康等级（根据文档标准）
   */
  private getWaistLevel(waist: number, gender: string): string {
    if (!waist) return '--'
    
    if (gender === 'male') {
      if (waist < 85) return '正常'
      if (waist < 90) return '中心型肥胖前期'
      return '中心型肥胖'
    } else {
      if (waist < 80) return '正常'
      if (waist < 85) return '中心型肥胖前期'
      return '中心型肥胖'
    }
  }

  /**
   * 计算体脂率（简化公式）
   * 使用 BMI 法
   */
  private calculateBodyFat(weight: number, height: number, gender: string, age: number): number {
    if (!height || !weight) return 0
    
    const bmi = weight / Math.pow(height / 100, 2)
    const genderFactor = gender === 'male' ? 1 : 0
    
    // 体脂率 = (1.20 × BMI) + (0.23 × 年龄) - (10.8 × 性别) - 5.4
    const bodyFat = (1.20 * bmi) + (0.23 * age) - (10.8 * genderFactor) - 5.4
    
    return Math.max(5, Math.min(40, parseFloat(bodyFat.toFixed(1))))
  }

  /**
   * 获取体脂率等级（根据文档标准）
   */
  private getBodyFatLevel(bodyFat: number, gender: string): string {
    if (gender === 'male') {
      if (bodyFat < 10) return '偏低'
      if (bodyFat <= 20) return '正常'
      if (bodyFat <= 25) return '偏高'
      return '肥胖'
    } else {
      if (bodyFat < 15) return '偏低'
      if (bodyFat <= 25) return '正常'
      if (bodyFat <= 30) return '偏高'
      return '肥胖'
    }
  }

  /**
   * 计算年龄
   */
  private calculateAge(birthDate: string): number {
    if (!birthDate) return 25
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  /**
   * 获取健康统计数据
   */
  async getHealthStats(userId: string) {
    const client = getSupabaseClient()

    // 获取当前用户的所有记录
    const { data: records, error } = await client
      .from('weight_records')
      .select('*')
      .eq('user_id', userId)
      .order('record_date', { ascending: false })
    
    if (error) throw new Error(`获取记录失败: ${error.message}`)
    
    if (!records || records.length === 0) {
      return {
        weightStats: { avg: 0, max: 0, maxDate: '', min: 0, minDate: '', stdDev: 0 },
        waistStats: { avg: 0, max: 0, maxDate: '', min: 0, minDate: '', stdDev: 0 },
        bmiLevel: { current: 0, level: '--', distribution: { underweight: 0, normal: 0, overweight: 0, obese: 0 } },
        bodyFatLevel: { current: 0, status: '--', healthyRange: { min: 0, max: 0 } }
      }
    }

    // 获取当前登录用户
    const { data: users } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    const user = users

    // 计算体重统计
    const weights = records.map(r => r.weight).filter(w => w !== null)
    const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length
    const maxWeight = Math.max(...weights)
    const minWeight = Math.min(...weights)
    const weightVariance = weights.reduce((sum, w) => sum + Math.pow(w - avgWeight, 2), 0) / weights.length
    const weightStdDev = Math.sqrt(weightVariance)

    const maxWeightRecord = records.find(r => r.weight === maxWeight)
    const minWeightRecord = records.find(r => r.weight === minWeight)

    // 计算腰围统计
    const waists = records.map(r => r.waist).filter(w => w !== null)
    const avgWaist = waists.reduce((a, b) => a + b, 0) / waists.length
    const maxWaist = Math.max(...waists)
    const minWaist = Math.min(...waists)
    const waistVariance = waists.reduce((sum, w) => sum + Math.pow(w - avgWaist, 2), 0) / waists.length
    const waistStdDev = Math.sqrt(waistVariance)

    const maxWaistRecord = records.find(r => r.waist === maxWaist)
    const minWaistRecord = records.find(r => r.waist === minWaist)

    // 计算 BMI
    let currentBmi = 0
    let bmiLevel = '--'
    if (user?.height && records[0]?.weight) {
      currentBmi = parseFloat((records[0].weight / Math.pow(user.height / 100, 2)).toFixed(1))
      bmiLevel = this.getBmiLevel(currentBmi)
    }

    // 计算体脂率
    let currentBodyFat = 0
    let bodyFatStatus = '--'
    if (user && records[0]) {
      currentBodyFat = this.calculateBodyFat(
        records[0].weight,
        user.height,
        user.gender,
        this.calculateAge(user.birth_date)
      )
      bodyFatStatus = this.getBodyFatLevel(currentBodyFat, user.gender)
    }

    // 计算腰围健康等级
    const currentWaist = records[0]?.waist || 0
    const waistLevel = this.getWaistLevel(currentWaist, user?.gender || 'male')

    // 计算身体成分指标
    const currentWeight = records[0]?.weight || 0
    let bodyComposition: {
      fatMass: number
      leanBodyMass: number
      bodyWater: number
      protein: number
      muscleMass: number
      skeletalMuscle: number
      boneMass: number
      vfi: number
      bmr: number
    } | null = null
    
    if (currentWeight && currentBodyFat) {
      // 脂肪量 = 体重 × 体脂率
      const fatMass = parseFloat((currentWeight * (currentBodyFat / 100)).toFixed(1))
      
      // 去脂体重（瘦体重）= 体重 - 脂肪量
      const leanBodyMass = parseFloat((currentWeight - fatMass).toFixed(1))
      
      // 水分 = 去脂体重 × 73.5%
      const bodyWater = parseFloat((leanBodyMass * 0.735).toFixed(1))
      
      // 蛋白质 = 去脂体重 × 19%
      const protein = parseFloat((leanBodyMass * 0.19).toFixed(1))
      
      // 骨量 = 体重 × 13%
      const boneMass = parseFloat((currentWeight * 0.13).toFixed(1))
      
      // 肌肉量 = 去脂体重 - 骨量
      const muscleMass = parseFloat((leanBodyMass - boneMass).toFixed(1))
      
      // 骨骼肌 = 肌肉量 × 71.4%
      const skeletalMuscle = parseFloat((muscleMass * 0.714).toFixed(1))
      
      // 内脏脂肪等级估算（基于腰围和BMI）
      let vfi = 0
      if (currentWaist) {
        vfi = Math.round(currentWaist / 10 * (currentBmi / 22))
      } else {
        vfi = Math.round(currentBmi * 0.5)
      }
      
      // 基础代谢率（Mifflin-St Jeor公式）
      const height = user?.height || 170
      const age = this.calculateAge(user?.birth_date)
      const bmr = user?.gender === 'male'
        ? Math.round(10 * currentWeight + 6.25 * height - 5 * age + 5)
        : Math.round(10 * currentWeight + 6.25 * height - 5 * age - 161)
      
      bodyComposition = {
        fatMass: parseFloat(fatMass.toFixed(1)),
        leanBodyMass: parseFloat(leanBodyMass.toFixed(1)),
        bodyWater: parseFloat(bodyWater.toFixed(1)),
        protein: parseFloat(protein.toFixed(1)),
        muscleMass: parseFloat(muscleMass.toFixed(1)),
        skeletalMuscle: parseFloat(skeletalMuscle.toFixed(1)),
        boneMass: parseFloat(boneMass.toFixed(1)),
        vfi: vfi > 0 ? vfi : 0,
        bmr: bmr
      }
    }

    // 根据性别获取健康区间
    const gender = user?.gender || 'male'
    const healthRanges = {
      bmi: {
        underweight: { max: 18.5, label: '体重过低' },
        normal: { min: 18.5, max: 23.9, label: '正常' },
        overweight: { min: 24, max: 27.9, label: '超重' },
        obese: { min: 28, label: '肥胖' }
      },
      bodyFat: {
        male: {
          low: { max: 10, label: '偏低' },
          normal: { min: 10, max: 20, label: '正常' },
          high: { min: 20, max: 25, label: '偏高' },
          obese: { min: 25, label: '肥胖' }
        },
        female: {
          low: { max: 15, label: '偏低' },
          normal: { min: 15, max: 25, label: '正常' },
          high: { min: 25, max: 30, label: '偏高' },
          obese: { min: 30, label: '肥胖' }
        }
      },
      waist: {
        male: {
          normal: { max: 85, label: '正常' },
          preObese: { min: 85, max: 90, label: '中心型肥胖前期' },
          obese: { min: 90, label: '中心型肥胖' }
        },
        female: {
          normal: { max: 80, label: '正常' },
          preObese: { min: 80, max: 85, label: '中心型肥胖前期' },
          obese: { min: 85, label: '中心型肥胖' }
        }
      }
    }

    return {
      weightStats: {
        avg: parseFloat(avgWeight.toFixed(1)),
        max: parseFloat(maxWeight.toFixed(1)),
        maxDate: maxWeightRecord?.record_date || '',
        min: parseFloat(minWeight.toFixed(1)),
        minDate: minWeightRecord?.record_date || '',
        stdDev: parseFloat(weightStdDev.toFixed(1))
      },
      waistStats: {
        avg: parseFloat(avgWaist.toFixed(1)),
        max: parseFloat(maxWaist.toFixed(1)),
        maxDate: maxWaistRecord?.record_date || '',
        min: parseFloat(minWaist.toFixed(1)),
        minDate: minWaistRecord?.record_date || '',
        stdDev: parseFloat(waistStdDev.toFixed(1)),
        level: waistLevel
      },
      bmiLevel: {
        current: currentBmi,
        level: bmiLevel,
        ranges: healthRanges.bmi
      },
      bodyFatLevel: {
        current: currentBodyFat,
        status: bodyFatStatus,
        ranges: healthRanges.bodyFat[gender]
      },
      waistLevel: {
        current: currentWaist,
        level: waistLevel,
        ranges: healthRanges.waist[gender]
      },
      bodyComposition,
      gender: gender
    }
  }

  /**
   * 计算体重管理方案
   * @param weeklyGoal 每周减重目标（kg）
   * @param activityLevel 活动水平
   */
  async calculateWeightPlan(userId: string, weeklyGoal: number, activityLevel: string) {
    const client = getSupabaseClient()

    // 获取当前登录用户
    const { data: users, error: userError } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (userError) throw new Error(`获取用户信息失败: ${userError.message}`)

    const user = users
    if (!user) {
      throw new Error('请先完善个人信息')
    }

    // 从 weight_records 获取最新体重记录
    const { data: latestRecord } = await client
      .from('weight_records')
      .select('weight')
      .eq('user_id', userId)
      .order('record_date', { ascending: false })
      .limit(1)
    
    // 使用最新打卡记录的体重，如果没有则使用用户表中的当前体重
    const currentWeight = latestRecord?.[0]?.weight || user.current_weight || 70
    const targetWeight = user.target_weight || currentWeight
    const height = user.height || 170
    const gender = user.gender || 'male'
    const age = this.calculateAge(user.birth_date)

    // 计算 BMI
    const bmi = parseFloat((currentWeight / Math.pow(height / 100, 2)).toFixed(1))

    // 计算体脂率
    const bodyFatRate = this.calculateBodyFat(currentWeight, height, gender, age)

    // 计算基础代谢率 (BMR) - Mifflin-StJeor 公式
    let bmr: number
    if (gender === 'male') {
      bmr = 10 * currentWeight + 6.25 * height - 5 * age + 5
    } else {
      bmr = 10 * currentWeight + 6.25 * height - 5 * age - 161
    }
    bmr = Math.round(bmr)

    // 活动系数
    const activityFactors: Record<string, number> = {
      'sedentary': 1.2,      // 久坐
      'light': 1.375,        // 轻度活动
      'moderate': 1.55,      // 中度活动
      'active': 1.725,       // 高度活动
      'veryActive': 1.9      // 极高活动
    }
    const activityFactor = activityFactors[activityLevel] || 1.2

    // 计算总热量消耗 (TDEE)
    const tdee = Math.round(bmr * activityFactor)

    // 判断是否已达成目标（当前体重 <= 目标体重）
    const isGoalAchieved = currentWeight <= targetWeight

    // 计算每日热量缺口
    // 1kg 脂肪 ≈ 7700 大卡
    // 每周减重 0.5kg 需要每日缺口约 550 大卡 (3850/7)
    // 每周减重 1kg 需要每日缺口约 1100 大卡 (7700/7)
    // 为安全起见，限制最大缺口为 500 大卡/天
    // 如果已达成目标，热量差按0计算
    let dailyDeficit: number
    if (isGoalAchieved) {
      // 已达成目标，热量差为0，维持当前体重
      dailyDeficit = 0
    } else if (weeklyGoal === 0.5) {
      dailyDeficit = 3850 / 7 // 约 550，取整为 550
    } else {
      dailyDeficit = 7700 / 7 // 约 1100，限制为 500
    }
    dailyDeficit = Math.min(dailyDeficit, 500) // 安全限制

    // 每日热量摄入额度
    let dailyCalories = Math.round(tdee - dailyDeficit)
    // 最低热量限制
    dailyCalories = Math.max(dailyCalories, 1200)

    // 计算达成目标所需周数
    const weightToLose = currentWeight - targetWeight
    const weeksToGoal = weightToLose > 0 ? Math.ceil(weightToLose / weeklyGoal) : 0

    // 计算营养配比
    // 蛋白质: 1.6-2.2g/kg，取 2g/kg，30% 热量
    const proteinGrams = Math.round(currentWeight * 2)
    const proteinCalories = proteinGrams * 4

    // 碳水: 45% 热量
    const carbsCalories = Math.round(dailyCalories * 0.45)
    const carbsGrams = Math.round(carbsCalories / 4)

    // 脂肪: 25% 热量
    const fatCalories = Math.round(dailyCalories * 0.25)
    const fatGrams = Math.round(fatCalories / 9)

    // 膳食纤维: 25-30g
    const fiber = 28

    // 水分摄入: 体重 × 30ml
    const water = Math.round(currentWeight * 30)

    return {
      bmi,
      bodyFatRate,
      bmr,
      tdee,
      dailyCalories,
      dailyDeficit,
      weeksToGoal,
      isGoalAchieved,
      protein: proteinGrams,
      carbs: carbsGrams,
      fat: fatGrams,
      fiber,
      water,
      weeklyGoal,
      activityLevel
    }
  }

  /**
   * 获取身体数据对比（第一条记录 vs 最新记录）
   */
  async getBodyDataComparison(userId: string) {
    const client = getSupabaseClient()

    // 获取当前登录用户
    const { data: users, error: userError } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (userError) throw new Error(`获取用户信息失败: ${userError.message}`)

    const user = users
    if (!user) {
      throw new Error('请先完善个人信息')
    }

    const height = user.height || 170
    const gender = user.gender || 'male'
    const age = this.calculateAge(user.birth_date)

    // 获取当前用户所有打卡记录，按日期排序
    const { data: records, error: recordsError } = await client
      .from('weight_records')
      .select('*')
      .eq('user_id', userId)
      .order('record_date', { ascending: true })
    
    if (recordsError) throw new Error(`获取打卡记录失败: ${recordsError.message}`)

    if (!records || records.length === 0) {
      return null
    }

    // 第一条记录和最新记录
    const firstRecord = records[0]
    const latestRecord = records[records.length - 1]

    // 计算天数差
    const firstDate = new Date(firstRecord.record_date)
    const latestDate = new Date(latestRecord.record_date)
    const daysDiff = Math.ceil((latestDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))

    // 辅助函数：计算各项指标
    const calculateMetrics = (weight: number, waist?: number) => {
      const bmi = parseFloat((weight / Math.pow(height / 100, 2)).toFixed(1))
      const bodyFatRate = this.calculateBodyFat(weight, height, gender, age)
      
      // 脂肪量 (kg)
      const fatMass = parseFloat((weight * bodyFatRate / 100).toFixed(1))
      // 去脂体重 (kg)
      const leanBodyMass = parseFloat((weight - fatMass).toFixed(1))
      // 水分 (kg) - 去脂体重的73.5%
      const bodyWater = parseFloat((leanBodyMass * 0.735).toFixed(1))
      // 蛋白质 (kg) - 去脂体重的19%
      const protein = parseFloat((leanBodyMass * 0.19).toFixed(1))
      // 骨量 (kg) - 体重的13%
      const boneMass = parseFloat((weight * 0.13).toFixed(1))
      // 肌肉量 (kg) - 去脂体重 - 骨量
      const muscleMass = parseFloat((leanBodyMass - boneMass).toFixed(1))
      // 骨骼肌 (kg) - 肌肉量的71.4%
      const skeletalMuscle = parseFloat((muscleMass * 0.714).toFixed(1))
      // 内脏脂肪指数 - 根据腰围和BMI估算
      let vfi = 0
      if (waist) {
        vfi = Math.round(waist / 10 * (bmi / 22))
      } else {
        vfi = Math.round(bmi * 0.5)
      }
      // 基础代谢率 (BMR)
      let bmr: number
      if (gender === 'male') {
        bmr = Math.round(10 * weight + 6.25 * height - 5 * age + 5)
      } else {
        bmr = Math.round(10 * weight + 6.25 * height - 5 * age - 161)
      }
      // 肥胖等级
      let obesityLevel = '标准'
      if (bmi < 18.5) obesityLevel = '偏瘦'
      else if (bmi >= 18.5 && bmi < 24) obesityLevel = '标准'
      else if (bmi >= 24 && bmi < 28) obesityLevel = '超重'
      else obesityLevel = '肥胖'
      
      // 身体年龄计算（按文档公式）
      // 身体年龄 = 基础身体年龄 × 40% + 进阶身体年龄 × 60%
      
      // 计算肌肉率（%）- 按骨骼肌重量占体重的比例
      const muscleRate = (skeletalMuscle / weight) * 100
      
      // 1. BMI年龄
      let bmiAge = age
      if (bmi >= 18.5 && bmi < 24) {
        bmiAge = age // BMI 18.5-23.9：等于实际年龄
      } else if (bmi >= 24 && bmi < 28) {
        bmiAge = age + 5 // BMI 24-27.9：实际年龄 + 5岁
      } else if (bmi >= 28) {
        bmiAge = age + 10 // BMI ≥ 28：实际年龄 + 10岁
      } else {
        bmiAge = age + 3 // BMI < 18.5：实际年龄 + 3岁
      }
      
      // 2. 腰围年龄
      let waistAge = age
      if (waist) {
        if (gender === 'male') {
          if (waist < 85) {
            waistAge = age // 男性腰围 < 85cm：等于实际年龄
          } else if (waist < 90) {
            waistAge = age + 5 // 男性腰围 85-90cm：实际年龄 + 5岁
          } else {
            waistAge = age + 10 // 男性腰围 ≥ 90cm：实际年龄 + 10岁
          }
        } else {
          if (waist < 80) {
            waistAge = age // 女性腰围 < 80cm：等于实际年龄
          } else if (waist < 85) {
            waistAge = age + 5 // 女性腰围 80-85cm：实际年龄 + 5岁
          } else {
            waistAge = age + 10 // 女性腰围 ≥ 85cm：实际年龄 + 10岁
          }
        }
      }
      
      // 3. 肌肉量年龄（基于骨骼肌率）
      let muscleAge = age
      if (gender === 'male') {
        if (muscleRate >= 33) {
          muscleAge = age - 5 // 男性骨骼肌率 ≥ 33%：实际年龄 - 5岁
        } else if (muscleRate >= 28) {
          muscleAge = age // 男性骨骼肌率 28-33%：等于实际年龄
        } else {
          muscleAge = age + 5 // 男性骨骼肌率 < 28%：实际年龄 + 5岁
        }
      } else {
        if (muscleRate >= 27) {
          muscleAge = age - 5 // 女性骨骼肌率 ≥ 27%：实际年龄 - 5岁
        } else if (muscleRate >= 22) {
          muscleAge = age // 女性骨骼肌率 22-27%：等于实际年龄
        } else {
          muscleAge = age + 5 // 女性骨骼肌率 < 22%：实际年龄 + 5岁
        }
      }
      
      // 4. 基础身体年龄 = 0.6 × 实际年龄 + 0.4 × BMI年龄 + 0.3 × 腰围年龄 - 0.3 × 肌肉量年龄
      const baseBodyAge = 0.6 * age + 0.4 * bmiAge + 0.3 * waistAge - 0.3 * muscleAge
      
      // 5. 进阶身体年龄 = 实际年龄 + (内脏脂肪等级 - 9) × 2 + (体脂率 - 标准体脂率) × 1 - (肌肉率 - 标准肌肉率) × 1
      const standardBodyFatRate = gender === 'male' ? 17.5 : 22.5
      const standardMuscleRate = gender === 'male' ? 33 : 27  // 标准骨骼肌率
      const advancedBodyAge = age + (vfi - 9) * 2 + (bodyFatRate - standardBodyFatRate) * 1 - (muscleRate - standardMuscleRate) * 1
      
      // 6. 最终身体年龄 = 基础身体年龄 × 40% + 进阶身体年龄 × 60%
      let bodyAge = Math.round(baseBodyAge * 0.4 + advancedBodyAge * 0.6)
      
      // 健康评分（按文档公式，5个维度各20分，总分100分）
      
      // 维度1：BMI指数（20分，男女通用）
      let bmiScore = 0
      if (bmi >= 18.5 && bmi < 24) {
        bmiScore = 20  // 标准体重
      } else if (bmi >= 24 && bmi < 28) {
        bmiScore = 14  // 超重
      } else {
        bmiScore = 6   // 偏瘦/肥胖
      }
      
      // 维度2：腰围（20分，男女分标准）
      let waistScore = 0
      if (waist) {
        if (gender === 'male') {
          if (waist < 85) waistScore = 20       // 正常无腹型肥胖
          else if (waist < 90) waistScore = 12  // 临界肥胖
          else waistScore = 5                    // 中心性肥胖
        } else {
          if (waist < 80) waistScore = 20       // 正常无腹型肥胖
          else if (waist < 85) waistScore = 12  // 临界肥胖
          else waistScore = 5                    // 中心性肥胖
        }
      } else {
        waistScore = 10  // 无腰围数据，给中等分
      }
      
      // 维度3：体脂率（20分，男女分标准）
      let bodyFatScore = 0
      if (gender === 'male') {
        if (bodyFatRate >= 15 && bodyFatRate <= 22) {
          bodyFatScore = 20  // 理想
        } else if (bodyFatRate >= 23 && bodyFatRate <= 27) {
          bodyFatScore = 13  // 偏高
        } else if (bodyFatRate < 12 || bodyFatRate > 27) {
          bodyFatScore = 6   // 过低/过高
        } else {
          bodyFatScore = 13  // 边界情况
        }
      } else {
        if (bodyFatRate >= 20 && bodyFatRate <= 28) {
          bodyFatScore = 20  // 理想
        } else if (bodyFatRate >= 29 && bodyFatRate <= 33) {
          bodyFatScore = 13  // 偏高
        } else if (bodyFatRate < 17 || bodyFatRate > 33) {
          bodyFatScore = 6   // 过低/过高
        } else {
          bodyFatScore = 13  // 边界情况
        }
      }
      
      // 维度4：骨骼肌肉率（20分，男女分标准）
      let muscleScore = 0
      if (gender === 'male') {
        if (muscleRate >= 35) muscleScore = 20       // 优秀
        else if (muscleRate >= 32) muscleScore = 14  // 合格
        else muscleScore = 7                          // 肌肉不足
      } else {
        if (muscleRate >= 30) muscleScore = 20       // 优秀
        else if (muscleRate >= 27) muscleScore = 14  // 合格
        else muscleScore = 7                          // 肌肉不足
      }
      
      // 维度5：身体年龄差值（20分，男女统一）
      let ageDiffScore = 0
      const ageDiff = bodyAge - age
      if (ageDiff < 0) {
        ageDiffScore = 20  // 身体年龄 < 实际年龄
      } else if (ageDiff === 0) {
        ageDiffScore = 15  // 身体年龄 = 实际年龄
      } else if (ageDiff <= 3) {
        ageDiffScore = 10  // 超出0-3岁
      } else {
        ageDiffScore = 4   // 超出>3岁
      }
      
      // 总分
      const healthScore = bmiScore + waistScore + bodyFatScore + muscleScore + ageDiffScore
      
      // 体重控制量 (kg) - 当前体重 - 标准体重
      const standardWeight = (height - 100) * 0.9
      const weightControl = parseFloat((weight - standardWeight).toFixed(1))
      
      // 脂肪控制量 (kg) - 当前脂肪量 - 标准脂肪量
      const standardFatRate = gender === 'male' ? 15 : 25
      const standardFatMass = weight * standardFatRate / 100
      const fatControl = parseFloat((fatMass - standardFatMass).toFixed(1))
      
      // 肌肉控制量 (kg) - 暂设为0
      const muscleControl = 0
      
      // 体型 - 根据腰围健康等级确定
      let bodyType = '标准型'
      if (waist) {
        // 有腰围数据时，根据腰围健康等级确定体型
        if (gender === 'male') {
          if (waist >= 90) bodyType = '肥胖型'
          else if (waist >= 85) bodyType = '偏胖型'
          else bodyType = '标准型'
        } else {
          if (waist >= 85) bodyType = '肥胖型'
          else if (waist >= 80) bodyType = '偏胖型'
          else bodyType = '标准型'
        }
      } else {
        // 无腰围数据时，使用体脂率估算
        if (bodyFatRate > (gender === 'male' ? 25 : 32)) bodyType = '肥胖型'
        else if (bodyFatRate > (gender === 'male' ? 20 : 28)) bodyType = '偏胖型'
        else if (bodyFatRate < (gender === 'male' ? 12 : 20)) bodyType = '偏瘦型'
      }
      
      return {
        weight,
        waist: waist || 0,
        bmi,
        bodyFatRate,
        fatMass,
        leanBodyMass,
        bodyWater,
        protein,
        boneMass,
        muscleMass,
        skeletalMuscle,
        vfi,
        bmr,
        healthScore,
        obesityLevel,
        bodyAge,
        weightControl,
        fatControl,
        muscleControl,
        bodyType
      }
    }

    // 计算第一条和最新记录的指标
    const firstMetrics = calculateMetrics(firstRecord.weight, firstRecord.waist)
    const latestMetrics = calculateMetrics(latestRecord.weight, latestRecord.waist)

    // 计算变化值
    const calculateChange = (latest: number, first: number, suffix: string = '', isDecreaseGood: boolean = false) => {
      const diff = parseFloat((latest - first).toFixed(1))
      const isPositive = diff > 0
      // isGood: 根据指标类型判断变化是否有利
      // 减少有利的指标：体重、体脂率、脂肪量、内脏脂肪指数、身体年龄
      // 增加有利的指标：肌肉量、水分、蛋白质、骨量、骨骼肌、BMR
      let isGood: boolean | null
      if (diff === 0) {
        isGood = null // 无变化，不好不坏
      } else if (isDecreaseGood) {
        isGood = diff < 0 // 下降是好事
      } else {
        isGood = diff > 0 // 上升是好事
      }
      return {
        value: Math.abs(diff),
        text: `${diff > 0 ? '+' : ''}${diff}${suffix}`,
        direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same',
        isGood
      }
    }

    return {
      summary: {
        days: daysDiff,
        weightLoss: parseFloat((firstRecord.weight - latestRecord.weight).toFixed(1)),
        fatLoss: parseFloat((firstMetrics.fatMass - latestMetrics.fatMass).toFixed(1))
      },
      firstRecord: {
        date: firstRecord.record_date,
        ...firstMetrics
      },
      latestRecord: {
        date: latestRecord.record_date,
        ...latestMetrics
      },
      changes: {
        weight: calculateChange(latestRecord.weight, firstRecord.weight, 'kg', true),
        bodyFatRate: calculateChange(latestMetrics.bodyFatRate, firstMetrics.bodyFatRate, '%', true),
        bmi: calculateChange(latestMetrics.bmi, firstMetrics.bmi, '', true),
        muscleMass: calculateChange(latestMetrics.muscleMass, firstMetrics.muscleMass, 'kg', false),
        protein: calculateChange(latestMetrics.protein, firstMetrics.protein, 'kg', false),
        fatMass: calculateChange(latestMetrics.fatMass, firstMetrics.fatMass, 'kg', true),
        bodyWater: calculateChange(latestMetrics.bodyWater, firstMetrics.bodyWater, 'kg', false),
        boneMass: calculateChange(latestMetrics.boneMass, firstMetrics.boneMass, 'kg', false),
        skeletalMuscle: calculateChange(latestMetrics.skeletalMuscle, firstMetrics.skeletalMuscle, 'kg', false),
        vfi: calculateChange(latestMetrics.vfi, firstMetrics.vfi, '', true),
        healthScore: calculateChange(latestMetrics.healthScore, firstMetrics.healthScore, '分', false),
        bodyAge: calculateChange(latestMetrics.bodyAge, firstMetrics.bodyAge, '岁', true),
        bmr: calculateChange(latestMetrics.bmr, firstMetrics.bmr, 'kcal', false),
        leanBodyMass: calculateChange(latestMetrics.leanBodyMass, firstMetrics.leanBodyMass, 'kg', false),
        weightControl: calculateChange(latestMetrics.weightControl, firstMetrics.weightControl, 'kg', true),
        fatControl: calculateChange(latestMetrics.fatControl, firstMetrics.fatControl, 'kg', true)
      }
    }
  }
}
