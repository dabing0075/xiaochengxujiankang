import { Controller, Get, Post, Body, Query } from '@nestjs/common'
import { HealthService } from './health.service'
import { CurrentUser } from '../auth/current-user.decorator'

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * 获取健康指标
   * 返回当前体重、腰围、BMI、体脂率等
   */
  @Get('metrics')
  async getMetrics(@CurrentUser('userId') userId: string) {
    console.log('[HealthController] GET /api/health/metrics')
    const data = await this.healthService.getHealthMetrics(userId)
    console.log('[HealthController] 返回数据:', data)
    return {
      code: 200,
      msg: 'success',
      data
    }
  }

  /**
   * 获取趋势数据
   * @param days 天数，默认7天
   */
  @Get('trend')
  async getTrend(
    @CurrentUser('userId') userId: string,
    @Query('days') days?: string,
  ) {
    const dayCount = parseInt(days || '7', 10)
    console.log(`[HealthController] GET /api/health/trend?days=${dayCount}`)
    const data = await this.healthService.getTrendData(userId, dayCount)
    console.log('[HealthController] 返回数据:', data)
    return {
      code: 200,
      msg: 'success',
      data
    }
  }

  /**
   * 获取统计数据
   * 返回体重、腰围、BMI、体脂率的统计分析
   */
  @Get('stats')
  async getStats(@CurrentUser('userId') userId: string) {
    console.log('[HealthController] GET /api/health/stats')
    const data = await this.healthService.getHealthStats(userId)
    console.log('[HealthController] 返回数据:', data)
    return {
      code: 200,
      msg: 'success',
      data
    }
  }

  /**
   * 计算体重管理方案
   * @param body.weeklyGoal 每周减重目标（0.5 或 1 kg）
   * @param body.activityLevel 活动水平（sedentary/light/moderate/active/veryActive）
   */
  @Post('weight-plan')
  async calculateWeightPlan(
    @CurrentUser('userId') userId: string,
    @Body() body: { weeklyGoal: number; activityLevel: string },
  ) {
    console.log('[HealthController] POST /api/health/weight-plan', body)
    const data = await this.healthService.calculateWeightPlan(
      userId,
      body.weeklyGoal,
      body.activityLevel
    )
    console.log('[HealthController] 返回数据:', data)
    return {
      code: 200,
      msg: 'success',
      data
    }
  }

  /**
   * 获取身体数据对比
   * 返回第一条记录与最新记录的对比数据
   */
  @Get('body-comparison')
  async getBodyComparison(@CurrentUser('userId') userId: string) {
    console.log('[HealthController] GET /api/health/body-comparison')
    const data = await this.healthService.getBodyDataComparison(userId)
    console.log('[HealthController] 返回数据:', data)
    return {
      code: 200,
      msg: 'success',
      data
    }
  }
}
