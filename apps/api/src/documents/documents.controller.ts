import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Allow, User, type CurrentUser } from '../auth/current-user.js';
import { ReadScopeService } from '../auth/read-scope.js';
import { ProjectScope } from '../auth/project-access.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { ProjectDocument } from '../db/schema.js';
import { DocumentInputSchema, type DocumentInput } from './documents.dto.js';
import { DocumentsService } from './documents.service.js';

@Controller()
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly scopes: ReadScopeService,
  ) {}

  /** GET /api/documents?projectId=… */
  @Get('documents')
  async list(@User() user: CurrentUser, @Query('projectId', new ParseUUIDPipe({ optional: true })) projectId?: string): Promise<ProjectDocument[]> {
    return (await this.scopes.for(user)).filter(await this.documents.list(projectId));
  }

  /** POST /api/projects/:projectId/documents */
  @Allow('document.upload')
  @ProjectScope('projectId', 'projects')
  @Post('projects/:projectId/documents')
  create(
    @User() user: CurrentUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(DocumentInputSchema)) body: DocumentInput,
  ): Promise<ProjectDocument> {
    return this.documents.create(projectId, body, user.employeeId);
  }

  /** DELETE /api/documents/:id (204) */
  @Allow('document.upload')
  @ProjectScope('id', 'projectDocuments')
  @Delete('documents/:id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.documents.remove(id);
  }
}
