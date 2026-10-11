import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { RecordsService } from './records.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('records')
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Post('checkin')
  async checkIn(
    @CurrentUser('userId') userId: string,
    @Body() body: { date: string; weight: number; waist: number; note?: string },
  ) {
    console.log('[RecordsController] POST /api/records/checkin', body);
    return this.recordsService.checkIn(userId, body);
  }

  @Get('recent')
  async getRecentRecords(
    @CurrentUser('userId') userId: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 7;
    console.log('[RecordsController] GET /api/records/recent', { days: daysNum });
    return this.recordsService.getRecentRecords(userId, daysNum);
  }

  @Get('date/:date')
  async getRecordByDate(
    @CurrentUser('userId') userId: string,
    @Param('date') date: string,
  ) {
    console.log('[RecordsController] GET /api/records/date/' + date);
    return this.recordsService.getRecordByDate(userId, date);
  }

  @Get('history')
  async getHistory(
    @CurrentUser('userId') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    console.log('[RecordsController] GET /api/records/history', { startDate, endDate });
    return this.recordsService.getHistory(userId, startDate, endDate);
  }

  @Get('stats')
  async getStats(@CurrentUser('userId') userId: string) {
    console.log('[RecordsController] GET /api/records/stats');
    return this.recordsService.getCheckinStats(userId);
  }

  @Get('export')
  async exportData(@CurrentUser('userId') userId: string) {
    console.log('[RecordsController] GET /api/records/export');
    return this.recordsService.exportAllRecords(userId);
  }
}
