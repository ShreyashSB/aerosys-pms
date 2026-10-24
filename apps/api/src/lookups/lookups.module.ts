import { Module } from '@nestjs/common';
import { LookupsController } from './lookups.controller.js';
import { LookupsService } from './lookups.service.js';

/** `exports` lets other modules (Projects) inject LookupsService. */
@Module({
  controllers: [LookupsController],
  providers: [LookupsService],
  exports: [LookupsService],
})
export class LookupsModule {}
