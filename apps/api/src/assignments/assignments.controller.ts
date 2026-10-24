import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { Assignment } from '../db/schema.js';
import { AssignmentInputSchema, type AssignmentInput } from './assignments.dto.js';
import { AssignmentsService } from './assignments.service.js';

/** No path on @Controller: each route spells out its own, since some hang off /projects/:id. */
@Controller()
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  /** GET /api/assignments?projectId=… (projectId optional) */
  @Get('assignments')
  list(@Query('projectId', new ParseUUIDPipe({ optional: true })) projectId?: string): Promise<Assignment[]> {
    return this.assignments.list(projectId);
  }

  /** POST /api/projects/:projectId/assignments */
  @Post('projects/:projectId/assignments')
  assign(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(AssignmentInputSchema)) body: AssignmentInput,
  ): Promise<Assignment> {
    return this.assignments.assign(projectId, body);
  }

  /** DELETE /api/assignments/:id → release the engineer (204) */
  @Delete('assignments/:id')
  @HttpCode(204)
  release(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.assignments.release(id);
  }
}
