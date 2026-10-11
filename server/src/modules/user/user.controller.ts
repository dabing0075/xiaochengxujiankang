import { Controller, Get, Post, Body, Put } from '@nestjs/common'
import { UserService } from './user.service'
import { UpdateUserDto } from './dto/update-user.dto'
import { CurrentUser } from '../auth/current-user.decorator'

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 获取用户信息
   */
  @Get('info')
  async getUserInfo(@CurrentUser('userId') userId: string) {
    console.log('[UserController] GET /api/user/info')
    const data = await this.userService.getUserInfo(userId)
    console.log('[UserController] 返回数据:', data)
    return {
      code: 200,
      msg: 'success',
      data
    }
  }

  /**
   * 更新用户信息
   */
  @Put('info')
  async updateUserInfo(
    @CurrentUser('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    console.log('[UserController] PUT /api/user/info')
    console.log('[UserController] 请求数据:', updateUserDto)
    const data = await this.userService.updateUserInfo(userId, updateUserDto)
    console.log('[UserController] 返回数据:', data)
    return {
      code: 200,
      msg: 'success',
      data
    }
  }

  /**
   * 初始化用户信息
   */
  @Post('init')
  async initUser(
    @CurrentUser('userId') userId: string,
    @Body() body: { nickname?: string; gender?: string; birth_date?: string; height?: number },
  ) {
    console.log('[UserController] POST /api/user/init')
    console.log('[UserController] 请求数据:', body)
    const data = await this.userService.initUser(userId, body)
    console.log('[UserController] 返回数据:', data)
    return {
      code: 200,
      msg: 'success',
      data
    }
  }

  /**
   * 提交意见反馈
   */
  @Post('feedback')
  async submitFeedback(
    @CurrentUser('userId') userId: string,
    @Body() body: { content: string; contact?: string },
  ) {
    console.log('[UserController] POST /api/user/feedback')
    if (!body?.content) {
      return { code: 400, msg: '反馈内容不能为空', data: null }
    }
    try {
      const data = await this.userService.submitFeedback(
        userId,
        body.content,
        body.contact,
      )
      return { code: 200, msg: 'success', data }
    } catch (err) {
      return { code: 500, msg: (err as Error).message, data: null }
    }
  }
}
