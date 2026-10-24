import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { Allow, User, type CurrentUser } from '../auth/current-user.js';
import { ReadScopeService } from '../auth/read-scope.js';
import { ProjectScope } from '../auth/project-access.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { EngineerReview } from '../db/schema.js';
import { ReviewsInputSchema, type ReviewsInput } from './reviews.dto.js';
import { ReviewsService } from './reviews.service.js';

const optionalUuid = new ParseUUIDPipe({ optional: true });

@Controller()
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly scopes: ReadScopeService,
  ) {}

  /** GET /api/engineer-reviews?projectId=… or ?employeeId=… */
  @Get('engineer-reviews')
  async list(
    @User() user: CurrentUser,
    @Query('projectId', optionalUuid) projectId?: string,
    @Query('employeeId', optionalUuid) employeeId?: string,
  ): Promise<EngineerReview[]> {
    const scope = await this.scopes.for(user);
    return scope.reviews ? scope.filter(await this.reviews.list({ projectId, employeeId })) : [];
  }

  /** PUT /api/projects/:projectId/reviews */
  @Allow('engineer.review')
  @ProjectScope('projectId', 'projects')
  @Put('projects/:projectId/reviews')
  save(
    @User() user: CurrentUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(ReviewsInputSchema)) body: ReviewsInput,
  ): Promise<EngineerReview[]> {
    return this.reviews.saveForProject(projectId, body, user.employeeId);
  }
}
