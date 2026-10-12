import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getSupabaseClient } from '../../storage/database/supabase-client';

// 通知接口
export interface Notification {
  id: string;
  title: string;
  content: string;
  type: string;
  created_at: string;
  targetUsers?: string[];
}

@Injectable()
export class AdminService {
  constructor(private readonly jwtService: JwtService) {}

  // 管理员登录验证
  async validateAdmin(username: string, password: string) {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (username === adminUsername && password === adminPassword) {
      return {
        success: true,
        token: this.jwtService.sign({ role: 'admin', username }),
      };
    }
    return { success: false, message: '用户名或密码错误' };
  }

  // 获取所有客户列表
  async getCustomers(
    page: number = 1,
    pageSize: number = 10,
    sortBy: string = 'totalWeightLost',
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const client = getSupabaseClient();

    // 获取所有用户数据（用于计算累计减重）
    const { data: allUsers, error, count } = await client
      .from('users')
      .select('*', { count: 'exact' });

    if (error) {
      console.error('获取客户列表失败:', error);
      return { data: [], total: 0, page, pageSize };
    }

    // 处理用户数据并计算累计减重
    let enrichedUsers = (allUsers || []).map((user) => {
      const currentWeight = user.current_weight || 0;
      const currentWaist = user.current_waist || 0;
      const initialWeight = user.initial_weight || currentWeight;

      // 计算累计减重（初始体重 - 当前体重）
      const totalWeightLoss = initialWeight > 0 && currentWeight > 0 
        ? Math.round((initialWeight - currentWeight) * 10) / 10 
        : 0;

      const targetWeight = user.target_weight || 0;
      const weightToGoal = targetWeight > 0 && currentWeight > 0 
        ? Math.round((currentWeight - targetWeight) * 10) / 10 
        : 0;

      return {
        id: user.id,
        nickname: user.nickname || '未设置',
        gender: user.gender || '未设置',
        height: user.height || 0,
        initialWeight: initialWeight,
        currentWeight: currentWeight,
        currentWaist: currentWaist,
        targetWeight: targetWeight,
        targetWaist: user.target_waist || 0,
        bmi: user.bmi || 0,
        bmiLevel: user.bmi_level || '',
        bodyFatRate: user.body_fat_rate || 0,
        bodyFatLevel: user.body_fat_level || '',
        waistLevel: user.waist_level || '',
        totalWeightLoss: totalWeightLoss,
        weightToGoal: weightToGoal,
        lastCheckinDate: user.last_checkin_date || '',
        createdAt: user.created_at || '',
      };
    });

    // 在内存中排序
    enrichedUsers.sort((a, b) => {
      let valueA: number, valueB: number;
      
      switch (sortBy) {
        case 'totalWeightLost':
          valueA = a.totalWeightLoss;
          valueB = b.totalWeightLoss;
          break;
        case 'weightToGoal':
          valueA = Math.abs(a.weightToGoal);
          valueB = Math.abs(b.weightToGoal);
          break;
        case 'currentWeight':
          valueA = a.currentWeight;
          valueB = b.currentWeight;
          break;
        case 'currentWaist':
          valueA = a.currentWaist;
          valueB = b.currentWaist;
          break;
        case 'created_at':
        default:
          valueA = new Date(a.createdAt).getTime();
          valueB = new Date(b.createdAt).getTime();
          break;
      }
      
      return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
    });

    // 分页
    const total = enrichedUsers.length;
    const from = (page - 1) * pageSize;
    const paginatedUsers = enrichedUsers.slice(from, from + pageSize);

    return {
      data: paginatedUsers,
      total: total,
      page,
      pageSize,
    };
  }

  // 获取客户详情
  async getCustomerDetail(userId: string) {
    const client = getSupabaseClient();
    
    // 获取用户基本信息
    const { data: user, error } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return null;
    }

    // 获取所有打卡记录（从 weight_records 表）
    const { data: rawRecords } = await client
      .from('weight_records')
      .select('*')
      .eq('user_id', userId)
      .order('record_date', { ascending: true });

    // 转换记录格式，供前端显示
    const records = rawRecords?.map(r => ({
      id: r.id,
      date: r.record_date,
      weight: r.weight,
      waist: r.waist,
      note: r.note,
    })) || [];

    // 使用用户表中的当前数据
    const currentWeight = user.current_weight || 0;
    const targetWeight = user.target_weight || 0;
    
    // 获取初始体重（从打卡记录的第一条）
    const initialWeight = user.initial_weight || (records && records.length > 0 ? records[0].weight : currentWeight);
    
    // 计算累计减重
    const weightLost = initialWeight && currentWeight 
      ? Math.round((initialWeight - currentWeight) * 10) / 10 
      : 0;

    return {
      user: {
        id: user.id,
        nickname: user.nickname || '未设置',
        gender: user.gender || '未设置',
        height: user.height || 0,
        currentWeight: currentWeight,
        currentWaist: user.current_waist || 0,
        targetWeight: targetWeight,
        targetWaist: user.target_waist || 0,
        initialWeight: initialWeight,
        bmi: user.bmi || 0,
        bmiLevel: user.bmi_level || '',
        bodyFatRate: user.body_fat_rate || 0,
        bodyFatLevel: user.body_fat_level || '',
        waistLevel: user.waist_level || '',
      },
      records: records || [],
      summary: {
        startWeight: initialWeight,
        currentWeight: currentWeight,
        targetWeight: targetWeight,
        weightLost: weightLost,
        weightToGoal: targetWeight > 0 && currentWeight > 0
          ? Math.round((currentWeight - targetWeight) * 10) / 10
          : 0,
        totalDays: records?.length || 0,
      },
    };
  }

  // 获取统计数据
  async getStatistics() {
    const client = getSupabaseClient();
    
    // 获取总用户数
    const { count: totalUsers } = await client
      .from('users')
      .select('*', { count: 'exact', head: true });

    // 获取今日打卡人数（从 weight_records 表）
    const today = new Date().toISOString().split('T')[0];
    const { count: todayCheckins } = await client
      .from('weight_records')
      .select('*', { count: 'exact', head: true })
      .eq('record_date', today);

    // 获取总打卡次数
    const { count: totalRecords } = await client
      .from('weight_records')
      .select('*', { count: 'exact', head: true });

    // 从用户表获取减重数据
    const { data: users } = await client
      .from('users')
      .select('current_weight, target_weight, initial_weight');

    let totalWeightToGoal = 0;
    let totalWeightLoss = 0;
    let userCountWithGoal = 0;

    for (const user of users || []) {
      if (user.current_weight && user.target_weight) {
        totalWeightToGoal += user.target_weight - user.current_weight;
        userCountWithGoal++;
      }
      // 计算累计减重：初始体重 - 当前体重
      if (user.initial_weight && user.current_weight) {
        totalWeightLoss += user.initial_weight - user.current_weight;
      }
    }

    return {
      totalUsers: totalUsers || 0,
      todayCheckins: todayCheckins || 0,
      totalRecords: totalRecords || 0,
      averageWeightToGoal: userCountWithGoal > 0
        ? Math.round((totalWeightToGoal / userCountWithGoal) * 10) / 10
        : 0,
      totalWeightToGoal: Math.round(totalWeightToGoal * 10) / 10,
      totalWeightLoss: Math.round(totalWeightLoss * 10) / 10,
    };
  }

  // 获取减重排行榜
  async getWeightLossRanking(limit: number = 10) {
    const client = getSupabaseClient();
    
    // 直接从用户表获取数据
    const { data: users } = await client
      .from('users')
      .select('id, nickname, avatar_url, gender, height, initial_weight, current_weight, target_weight, bmi, body_fat_rate, last_checkin_date')
      .not('current_weight', 'is', null);

    // 计算累计减重并排序
    const rankings: Array<{
      userId: string;
      nickname: string;
      avatarUrl: string | null;
      gender: string;
      height: number;
      initialWeight: number;
      currentWeight: number;
      targetWeight: number;
      totalWeightLoss: number;
      bmi: number;
      bodyFatRate: number;
      lastCheckinDate: string;
      isGoalAchieved: boolean;
    }> = [];

    for (const user of users || []) {
      const currentWeight = user.current_weight || 0;
      const initialWeight = user.initial_weight || currentWeight;
      const targetWeight = user.target_weight || 0;
      
      // 累计减重 = 初始体重 - 当前体重
      const totalWeightLoss = initialWeight > 0 && currentWeight > 0
        ? Math.round((initialWeight - currentWeight) * 10) / 10
        : 0;
      
      // 是否达标：当前体重 <= 目标体重
      const isGoalAchieved = targetWeight > 0 && currentWeight <= targetWeight;
      
      if (currentWeight > 0) {
        rankings.push({
          userId: user.id,
          nickname: user.nickname || '未设置',
          avatarUrl: user.avatar_url,
          gender: user.gender || 'unknown',
          height: user.height || 0,
          initialWeight: initialWeight,
          currentWeight: currentWeight,
          targetWeight: targetWeight,
          totalWeightLoss: totalWeightLoss,
          bmi: user.bmi || 0,
          bodyFatRate: user.body_fat_rate || 0,
          lastCheckinDate: user.last_checkin_date || '',
          isGoalAchieved: isGoalAchieved,
        });
      }
    }

    // 按累计减重从大到小排序（减重越多排越前面）
    rankings.sort((a, b) => b.totalWeightLoss - a.totalWeightLoss);

    return rankings.slice(0, limit);
  }

  // 创建通知（使用数据库存储）
  async createNotification(
    title: string,
    content: string,
    type: string = 'system',
    targetUsers?: string[],
  ) {
    const client = getSupabaseClient();
    
    // 插入全局通知到数据库
    const { data, error } = await client
      .from('global_notifications')
      .insert({
        title,
        content,
        type,
      })
      .select()
      .single();

    if (error) {
      console.error('创建通知失败:', error);
      return { success: false, message: '创建通知失败' };
    }

    // 确定接收者：未指定目标用户则广播给所有用户
    let recipients: string[] = [];
    if (targetUsers && targetUsers.length > 0) {
      recipients = targetUsers;
    } else {
      const { data: allUsers } = await client
        .from('users')
        .select('id');
      recipients = (allUsers || []).map((u: any) => u.id);
    }

    // 为每个接收者创建 user_notifications 关联，保证 App 与小程序都能读到
    if (data && recipients.length > 0) {
      const userNotificationData = recipients.map(userId => ({
        user_id: userId,
        notification_id: data.id,
        is_read: false,
      }));

      const { error: userError } = await client
        .from('user_notifications')
        .insert(userNotificationData);

      if (userError) {
        console.error('创建用户通知关联失败:', userError);
      }
    }

    console.log('通知创建成功:', { title, content, type, targetUsers });
    return { success: true, message: '通知创建成功', data };
  }

  // 获取通知列表（使用数据库存储）
  async getNotifications(page: number = 1, pageSize: number = 20) {
    const client = getSupabaseClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    // 获取总数
    const { count, error: countError } = await client
      .from('global_notifications')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('获取通知总数失败:', countError);
    }

    // 分页获取通知列表
    const { data, error } = await client
      .from('global_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('获取通知列表失败:', error);
      return {
        data: [],
        total: 0,
        page,
        pageSize,
      };
    }

    return {
      data: data || [],
      total: count || 0,
      page,
      pageSize,
    };
  }

  // 删除通知（使用数据库存储）
  async deleteNotification(notificationId: string) {
    const client = getSupabaseClient();
    
    // 先删除关联的用户通知记录
    await client
      .from('user_notifications')
      .delete()
      .eq('notification_id', notificationId);
    
    // 再删除全局通知
    const { error } = await client
      .from('global_notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('删除通知失败:', error);
      return { success: false, message: '删除失败' };
    }
    
    return { success: true, message: '删除成功' };
  }

  // 获取所有用户列表（用于通知推送选择）
  async getAllUsersForNotification() {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('users')
      .select('id, nickname, avatar_url')
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    return data || [];
  }
}
