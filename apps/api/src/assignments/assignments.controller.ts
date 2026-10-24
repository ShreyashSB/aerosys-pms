import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Allow, User, type CurrentUser } from '../auth/current-user.js';
import { ReadScopeService } from '../auth/read-scope.js';
import { ProjectScope } from '../auth/project-access.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { Assignment } from '../db/schema.js';
import { AssignmentInputSchema, type AssignmentInput } from './assignments.dto.js';
import { AssignmentsService } from './assignments.service.js';

/** No path on @Controller: each route spells out its own, since some hang off /projects/:id. */
@Controller()
export class AssignmentsController {
  constructor(
    private readonly assignments: AssignmentsService,
    private readonly scopes: ReadScopeService,
  ) {}

  /** GET /api/assignments?projectId=… (projectId optional) */
  @Get('assignments')
  async list(@User() user: CurrentUser, @Query('projectId', new ParseUUIDPipe({ optional: true })) projectId?: string): Promise<Assignment[]> {
    return (await this.scopes.for(user)).filter(await this.assignments.list(projectId));
  }

  /** POST /api/projects/:projectId/assignments */
  @Allow('project.assign')
  @ProjectScope('projectId', 'projects')
  @Post('projects/:projectId/assignments')
  assign(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(AssignmentInputSchema)) body: AssignmentInput,
  ): Promise<Assignment> {
    return this.assignments.assign(projectId, body);
  }

  /** DELETE /api/assignments/:id → release the engineer (204) */
  @Allow('project.assign')
  @ProjectScope('id', 'assignments')
  @Delete('assignments/:id')
  @HttpCode(204)
  release(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.assignments.release(id);
  }
}
