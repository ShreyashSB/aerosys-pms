import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { BoqExecution, BoqItem } from '../db/schema.js';
import { BoqItemInputSchema, ExecutionInputSchema, type BoqItemInput, type ExecutionInput } from './boq.dto.js';
import { BoqService } from './boq.service.js';

const optionalUuid = new ParseUUIDPipe({ optional: true });

@Controller()
export class BoqController {
  constructor(private readonly boq: BoqService) {}

  /** GET /api/boq-items?projectId=… */
  @Get('boq-items')
  listItems(@Query('projectId', optionalUuid) projectId?: string): Promise<BoqItem[]> {
    return this.boq.listItems(projectId);
  }

  /** POST /api/projects/:projectId/boq-items */
  @Post('projects/:projectId/boq-items')
  createItem(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(BoqItemInputSchema)) body: BoqItemInput,
  ): Promise<BoqItem> {
    return this.boq.createItem(projectId, body);
  }

  /** PUT /api/boq-items/:id */
  @Put('boq-items/:id')
  updateItem(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(BoqItemInputSchema)) body: BoqItemInput): Promise<BoqItem> {
    return this.boq.updateItem(id, body);
  }

  /** DELETE /api/boq-items/:id (204) */
  @Delete('boq-items/:id')
  @HttpCode(204)
  deleteItem(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.boq.deleteItem(id);
  }

  /** GET /api/boq-executions?projectId=… */
  @Get('boq-executions')
  listExecutions(@Query('projectId', optionalUuid) projectId?: string): Promise<BoqExecution[]> {
    return this.boq.listExecutions(projectId);
  }

  /** POST /api/boq-items/:id/executions */
  @Post('boq-items/:id/executions')
  addExecution(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ExecutionInputSchema)) body: ExecutionInput,
  ): Promise<BoqExecution> {
    return this.boq.addExecution(id, body);
  }

  /** DELETE /api/boq-executions/:id (204) */
  @Delete('boq-executions/:id')
  @HttpCode(204)
  deleteExecution(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.boq.deleteExecution(id);
  }

  /** POST /api/projects/:projectId/close-period (204) */
  @Post('projects/:projectId/close-period')
  @HttpCode(204)
  closePeriod(@Param('projectId', ParseUUIDPipe) projectId: string): Promise<void> {
    return this.boq.closePeriod(projectId);
  }
}
