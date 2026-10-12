import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../../storage/database/supabase-client';

@Injectable()
export class RecordsService {
  private supabase = getSupabaseClient();

  /**
   * 计算BMI等级
   */
  private getBmiLevel(bmi: number): string {
    if (bmi < 18.5) return '偏瘦';
    if (bmi < 24) return '正常';
    if (bmi < 28) return '超重';
    return '肥胖';
  }

  /**
   * 计算体脂率（成人公式）
   */
  private calculateBodyFat(bmi: number, age: number, gender: string): number {
    // 成人体脂率计算公式
    const genderFactor = gender === 'male' ? 1 : 0;
    const bodyFat = (1.2 * bmi) + (0.23 * age) - (10.8 * genderFactor) - 5.4;
    return Math.round(bodyFat * 10) / 10;
  }

  /**
   * 获取体脂率等级
   */
  private getBodyFatLevel(bodyFat: number, gender: string): string {
    if (gender === 'male') {
      if (bodyFat < 10) return '偏低';
      if (bodyFat < 20) return '正常';
      if (bodyFat < 25) return '偏高';
      return '肥胖';
    } else {
      if (bodyFat < 20) return '偏低';
      if (bodyFat < 30) return '正常';
      if (bodyFat < 35) return '偏高';
      return '肥胖';
    }
  }

  /**
   * 获取腰围等级
   */
  private getWaistLevel(waist: number, gender: string): string {
    if (gender === 'male') {
      if (waist < 85) return '正常';
      if (waist < 90) return '中心型肥胖前期';
      return '中心型肥胖';
    } else {
      if (waist < 80) return '正常';
      if (waist < 85) return '中心型肥胖前期';
      return '中心型肥胖';
    }
  }

  async checkIn(userId: string, data: { date: string; weight: number; waist: number; note?: string }) {
    // 检查当天是否已打卡，同时检查是否是首次打卡
    const { data: existing, error: checkError } = await this.supabase
      .from('weight_records')
      .select('id')
      .eq('user_id', userId)
      .eq('record_date', data.date)
      .single();

    // 检查是否是首次打卡（在插入新记录之前检查）
    const { data: allRecords } = await this.supabase
      .from('weight_records')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
    const isFirstCheckin = !allRecords || allRecords.length === 0;

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[RecordsService] 检查记录失败', checkError);
      return { code: 500, msg: '检查记录失败', data: null };
    }

    if (existing) {
      // 更新现有记录
      const { data: updated, error: updateError } = await this.supabase
        .from('weight_records')
        .update({
          weight: data.weight,
          waist: data.waist,
          note: data.note || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error('[RecordsService] 更新记录失败', updateError);
        return { code: 500, msg: '更新记录失败', data: null };
      }

      // 更新用户健康指标（不是首次打卡）
      await this.updateUserHealthMetrics(userId, data.weight, data.waist, data.date, false);

      console.log('[RecordsService] 更新记录成功', updated);
      return { code: 200, msg: '记录已更新', data: updated };
    }

    // 创建新记录
    const { data: newRecord, error: insertError } = await this.supabase
      .from('weight_records')
      .insert({
        user_id: userId,
        record_date: data.date,
        weight: data.weight,
        waist: data.waist,
        note: data.note || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[RecordsService] 创建记录失败', insertError);
      return { code: 500, msg: '创建记录失败', data: null };
    }

    // 更新用户健康指标（首次打卡时设置初始体重）
    await this.updateUserHealthMetrics(userId, data.weight, data.waist, data.date, isFirstCheckin);

    console.log('[RecordsService] 创建记录成功', newRecord);
    return { code: 200, msg: '打卡成功', data: newRecord };
  }

  /**
   * 更新用户健康指标
   */
  private async updateUserHealthMetrics(userId: string, weight: number, waist: number, date: string, isFirstCheckin: boolean = false) {
    try {
      // 获取用户信息
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('height, gender, birth_date')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        console.error('[RecordsService] 获取用户信息失败', userError);
        return;
      }

      const height = Number(user.height) || 170; // 身高单位：厘米（未填写时默认 170，与 App 保持一致）
      const gender = user.gender || 'male';

      // 计算年龄
      const birthDate = new Date(user.birth_date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();

      // 计算健康指标
      const heightM = height / 100;
      const bmi = Math.round((weight / (heightM * heightM)) * 10) / 10;
      const bmiLevel = this.getBmiLevel(bmi);
      const bodyFat = this.calculateBodyFat(bmi, age, gender);
      const bodyFatLevel = this.getBodyFatLevel(bodyFat, gender);
      const waistLevel = this.getWaistLevel(waist, gender);

      // 更新用户表
      const updateData: Record<string, unknown> = {
        current_weight: weight,
        current_waist: waist,
        bmi: bmi,
        bmi_level: bmiLevel,
        body_fat_rate: bodyFat,
        body_fat_level: bodyFatLevel,
        waist_level: waistLevel,
        last_checkin_date: date,
        updated_at: new Date().toISOString(),
      };

      // 如果是首次打卡，设置初始体重
      if (isFirstCheckin) {
        updateData.initial_weight = weight;
        console.log('[RecordsService] 首次打卡，设置初始体重:', weight);
      }

      const { error: updateError } = await this.supabase
        .from('users')
        .update(updateData)
        .eq('id', userId);

      if (updateError) {
        console.error('[RecordsService] 更新用户健康指标失败', updateError);
      } else {
        console.log('[RecordsService] 更新用户健康指标成功', {
          weight, waist, bmi, bmiLevel, bodyFat, bodyFatLevel, waistLevel
        });
      }
    } catch (err) {
      console.error('[RecordsService] 更新用户健康指标异常', err);
    }
  }

  async getRecentRecords(userId: string, days: number) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);

    const { data, error } = await this.supabase
      .from('weight_records')
      .select('*')
      .eq('user_id', userId)
      .gte('record_date', startDate.toISOString().split('T')[0])
      .lte('record_date', endDate.toISOString().split('T')[0])
      .order('record_date', { ascending: false });

    if (error) {
      console.error('[RecordsService] 获取最近记录失败', error);
      return { code: 500, msg: '获取记录失败', data: null };
    }

    console.log('[RecordsService] 获取最近记录成功', data?.length || 0, '条');
    return { code: 200, msg: 'success', data };
  }

  async getRecordByDate(userId: string, date: string) {
    const { data, error } = await this.supabase
      .from('weight_records')
      .select('*')
      .eq('user_id', userId)
      .eq('record_date', date)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[RecordsService] 获取日期记录失败', error);
      return { code: 500, msg: '获取记录失败', data: null };
    }

    if (!data) {
      console.log('[RecordsService] 该日期无记录', date);
      return { code: 404, msg: '该日期无记录', data: null };
    }

    console.log('[RecordsService] 获取日期记录成功', date, data);
    return { code: 200, msg: 'success', data };
  }

  async getHistory(userId: string, startDate?: string, endDate?: string) {
    let query = this.supabase
      .from('weight_records')
      .select('*')
      .eq('user_id', userId);

    if (startDate) {
      query = query.gte('record_date', startDate);
    }
    if (endDate) {
      query = query.lte('record_date', endDate);
    }

    const { data, error } = await query.order('record_date', { ascending: false });

    if (error) {
      console.error('[RecordsService] 获取历史记录失败', error);
      return { code: 500, msg: '获取记录失败', data: null };
    }

    console.log('[RecordsService] 获取历史记录成功', data?.length || 0, '条');
    return { code: 200, msg: 'success', data };
  }

  async getCheckinStats(userId: string) {
    // 获取所有记录
    const { data: records, error } = await this.supabase
      .from('weight_records')
      .select('record_date')
      .eq('user_id', userId)
      .order('record_date', { ascending: false });

    if (error) {
      console.error('[RecordsService] 获取打卡统计失败', error);
      return { code: 500, msg: '获取统计失败', data: null };
    }

    const totalDays = records?.length || 0;

    // 计算连续打卡天数
    let continuousDays = 0;
    if (records && records.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < records.length; i++) {
        const recordDate = new Date(records[i].record_date);
        recordDate.setHours(0, 0, 0, 0);

        const expectedDate = new Date(today);
        expectedDate.setDate(expectedDate.getDate() - i);

        if (recordDate.getTime() === expectedDate.getTime()) {
          continuousDays++;
        } else {
          break;
        }
      }
    }

    // 计算本月打卡天数
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthDays = records?.filter(r => new Date(r.record_date) >= monthStart).length || 0;

    console.log('[RecordsService] 打卡统计', { totalDays, continuousDays, monthDays });
    return {
      code: 200,
      msg: 'success',
      data: {
        totalDays,
        continuousDays,
        monthDays
      }
    };
  }

  async exportAllRecords(userId: string) {
    const { data, error } = await this.supabase
      .from('weight_records')
      .select('*')
      .eq('user_id', userId)
      .order('record_date', { ascending: false });

    if (error) {
      console.error('[RecordsService] 导出记录失败', error);
      return { code: 500, msg: '导出失败', data: null };
    }

    console.log('[RecordsService] 导出记录成功', data?.length || 0, '条');
    return { code: 200, msg: 'success', data };
  }
}
