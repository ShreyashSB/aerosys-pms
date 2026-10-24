import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { ProjectDocument } from '../db/schema.js';
import { DocumentInputSchema, type DocumentInput } from './documents.dto.js';
import { DocumentsService } from './documents.service.js';

@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /** GET /api/documents?projectId=… */
  @Get('documents')
  list(@Query('projectId', new ParseUUIDPipe({ optional: true })) projectId?: string): Promise<ProjectDocument[]> {
    return this.documents.list(projectId);
  }

  /** POST /api/projects/:projectId/documents */
  @Post('projects/:projectId/documents')
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(DocumentInputSchema)) body: DocumentInput,
  ): Promise<ProjectDocument> {
    return this.documents.create(projectId, body);
  }

  /** DELETE /api/documents/:id (204) */
  @Delete('documents/:id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.documents.remove(id);
  }
}
