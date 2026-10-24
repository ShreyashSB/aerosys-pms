import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { EngineerReview } from '../db/schema.js';
import { ReviewsInputSchema, type ReviewsInput } from './reviews.dto.js';
import { ReviewsService } from './reviews.service.js';

const optionalUuid = new ParseUUIDPipe({ optional: true });

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** GET /api/engineer-reviews?projectId=… or ?employeeId=… */
  @Get('engineer-reviews')
  list(@Query('projectId', optionalUuid) projectId?: string, @Query('employeeId', optionalUuid) employeeId?: string): Promise<EngineerReview[]> {
    return this.reviews.list({ projectId, employeeId });
  }

  /** PUT /api/projects/:projectId/reviews */
  @Put('projects/:projectId/reviews')
  save(@Param('projectId', ParseUUIDPipe) projectId: string, @Body(new ZodValidationPipe(ReviewsInputSchema)) body: ReviewsInput): Promise<EngineerReview[]> {
    return this.reviews.saveForProject(projectId, body);
  }
}
