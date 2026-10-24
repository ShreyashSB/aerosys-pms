import { Module } from '@nestjs/common';
import { DailyLogsController } from './daily-logs.controller.js';
import { DailyLogsService } from './daily-logs.service.js';

@Module({
  controllers: [DailyLogsController],
  providers: [DailyLogsService],
})
export class DailyLogsModule {}
