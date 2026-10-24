import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { ProjectBill } from '../db/schema.js';
import { BillInputSchema, type BillInput } from './bills.dto.js';
import { BillsService } from './bills.service.js';

@Controller()
export class BillsController {
  constructor(private readonly bills: BillsService) {}

  /** GET /api/bills?projectId=… */
  @Get('bills')
  list(@Query('projectId', new ParseUUIDPipe({ optional: true })) projectId?: string): Promise<ProjectBill[]> {
    return this.bills.list(projectId);
  }

  /** POST /api/projects/:projectId/bills */
  @Post('projects/:projectId/bills')
  create(@Param('projectId', ParseUUIDPipe) projectId: string, @Body(new ZodValidationPipe(BillInputSchema)) body: BillInput): Promise<ProjectBill> {
    return this.bills.create(projectId, body);
  }

  /** PUT /api/bills/:id */
  @Put('bills/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(BillInputSchema)) body: BillInput): Promise<ProjectBill> {
    return this.bills.update(id, body);
  }

  /** DELETE /api/bills/:id (204) */
  @Delete('bills/:id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.bills.remove(id);
  }
}
