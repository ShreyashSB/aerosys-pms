import { Module } from '@nestjs/common';
import { BoqController } from './boq.controller.js';
import { BoqService } from './boq.service.js';

@Module({
  controllers: [BoqController],
  providers: [BoqService],
})
export class BoqModule {}
