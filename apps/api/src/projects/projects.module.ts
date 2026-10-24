import { Module } from '@nestjs/common';
import { LookupsModule } from '../lookups/lookups.module.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

/** Imports LookupsModule to use its exported LookupsService. */
@Module({
  imports: [LookupsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
