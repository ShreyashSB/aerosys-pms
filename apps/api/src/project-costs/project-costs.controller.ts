import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Allow } from '../auth/current-user.js';
import { ProjectScope } from '../auth/project-access.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { ProjectCost } from '../db/schema.js';
import { ProjectCostInputSchema, type ProjectCostInput } from './project-costs.dto.js';
import { ProjectCostsService } from './project-costs.service.js';

@Controller()
export class ProjectCostsController {
  constructor(private readonly costs: ProjectCostsService) {}

  /** GET /api/project-costs?projectId=… */
  @Get('project-costs')
  list(@Query('projectId', new ParseUUIDPipe({ optional: true })) projectId?: string): Promise<ProjectCost[]> {
    return this.costs.list(projectId);
  }

  /** POST /api/projects/:projectId/costs */
  @Allow('project.costs.edit')
  @ProjectScope('projectId', 'projects')
  @Post('projects/:projectId/costs')
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(ProjectCostInputSchema)) body: ProjectCostInput,
  ): Promise<ProjectCost> {
    return this.costs.create(projectId, body);
  }

  /** DELETE /api/project-costs/:id (204) */
  @Allow('project.costs.edit')
  @ProjectScope('id', 'projectCosts')
  @Delete('project-costs/:id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.costs.remove(id);
  }
}
