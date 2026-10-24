import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Allow, User, type CurrentUser } from '../auth/current-user.js';
import { ReadScopeService } from '../auth/read-scope.js';
import { ProjectScope } from '../auth/project-access.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { BoqExecution, BoqItem } from '../db/schema.js';
import { BoqItemInputSchema, ExecutionInputSchema, type BoqItemInput, type ExecutionInput } from './boq.dto.js';
import { BoqService } from './boq.service.js';

const optionalUuid = new ParseUUIDPipe({ optional: true });

@Controller()
export class BoqController {
  constructor(
    private readonly boq: BoqService,
    private readonly scopes: ReadScopeService,
  ) {}

  /** GET /api/boq-items?projectId=… */
  @Get('boq-items')
  async listItems(@User() user: CurrentUser, @Query('projectId', optionalUuid) projectId?: string): Promise<BoqItem[]> {
    return (await this.scopes.for(user)).filter(await this.boq.listItems(projectId));
  }

  /** POST /api/projects/:projectId/boq-items */
  @Allow('boq.edit')
  @ProjectScope('projectId', 'projects')
  @Post('projects/:projectId/boq-items')
  createItem(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(BoqItemInputSchema)) body: BoqItemInput,
  ): Promise<BoqItem> {
    return this.boq.createItem(projectId, body);
  }

  /** PUT /api/boq-items/:id */
  @Allow('boq.edit')
  @ProjectScope('id', 'boqItems')
  @Put('boq-items/:id')
  updateItem(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(BoqItemInputSchema)) body: BoqItemInput): Promise<BoqItem> {
    return this.boq.updateItem(id, body);
  }

  /** DELETE /api/boq-items/:id (204) */
  @Allow('boq.edit')
  @ProjectScope('id', 'boqItems')
  @Delete('boq-items/:id')
  @HttpCode(204)
  deleteItem(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.boq.deleteItem(id);
  }

  /** GET /api/boq-executions?projectId=… */
  @Get('boq-executions')
  async listExecutions(@User() user: CurrentUser, @Query('projectId', optionalUuid) projectId?: string): Promise<BoqExecution[]> {
    return (await this.scopes.for(user)).filter(await this.boq.listExecutions(projectId));
  }

  /** POST /api/boq-items/:id/executions */
  @Allow('boq.edit')
  @ProjectScope('id', 'boqItems')
  @Post('boq-items/:id/executions')
  addExecution(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ExecutionInputSchema)) body: ExecutionInput,
  ): Promise<BoqExecution> {
    return this.boq.addExecution(id, body);
  }

  /** DELETE /api/boq-executions/:id (204) */
  @Allow('boq.edit')
  @ProjectScope('id', 'boqExecutions')
  @Delete('boq-executions/:id')
  @HttpCode(204)
  deleteExecution(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.boq.deleteExecution(id);
  }

  /** POST /api/projects/:projectId/close-period (204) */
  @Allow('boq.edit')
  @ProjectScope('projectId', 'projects')
  @Post('projects/:projectId/close-period')
  @HttpCode(204)
  closePeriod(@Param('projectId', ParseUUIDPipe) projectId: string): Promise<void> {
    return this.boq.closePeriod(projectId);
  }
}
