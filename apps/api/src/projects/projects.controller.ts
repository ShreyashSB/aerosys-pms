import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ProjectInputSchema, ProjectStatusSchema, type ProjectDto, type ProjectInput } from './projects.dto.js';
import { ProjectsService } from './projects.service.js';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  /** GET /api/projects */
  @Get()
  list(): Promise<ProjectDto[]> {
    return this.projects.list();
  }

  /** GET /api/projects/:id */
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ProjectDto> {
    return this.projects.get(id);
  }

  /** POST /api/projects */
  @Post()
  create(@Body(new ZodValidationPipe(ProjectInputSchema)) body: ProjectInput): Promise<ProjectDto> {
    return this.projects.create(body);
  }

  /** PUT /api/projects/:id */
  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ProjectInputSchema)) body: ProjectInput,
  ): Promise<ProjectDto> {
    return this.projects.update(id, body);
  }

  /** PATCH /api/projects/:id/status  { "status": "on_hold" } */
  @Patch(':id/status')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ProjectStatusSchema)) body: { status: ProjectDto['status'] },
  ): Promise<ProjectDto> {
    return this.projects.setStatus(id, body.status);
  }

  /** DELETE /api/projects/:id → 204 No Content */
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.projects.remove(id);
  }
}
