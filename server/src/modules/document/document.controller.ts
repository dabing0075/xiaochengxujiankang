import { Controller, Get, Query } from '@nestjs/common'
import { DocumentService } from './document.service'
import { Public } from '../auth/public.decorator'

@Controller('document')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Public()
  @Get('parse')
  async parseDocument(@Query('url') url: string) {
    // 文档解析功能暂时禁用
    // 已通过 Python 脚本手动解析了健康标准文档
    return {
      success: false,
      message: 'Document parsing is temporarily disabled. Health standards have been manually extracted.'
    }
  }
}
