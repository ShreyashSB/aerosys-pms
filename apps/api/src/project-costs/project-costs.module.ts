import { Module } from '@nestjs/common';
import { ProjectCostsController } from './project-costs.controller.js';
import { ProjectCostsService } from './project-costs.service.js';

@Module({
  controllers: [ProjectCostsController],
  providers: [ProjectCostsService],
})
export class ProjectCostsModule {}
