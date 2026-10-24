import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Allow, User, type CurrentUser } from '../auth/current-user.js';
import { ReadScopeService } from '../auth/read-scope.js';
import { ProjectScope } from '../auth/project-access.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { ProjectBill } from '../db/schema.js';
import { BillInputSchema, type BillInput } from './bills.dto.js';
import { BillsService } from './bills.service.js';

@Controller()
export class BillsController {
  constructor(
    private readonly bills: BillsService,
    private readonly scopes: ReadScopeService,
  ) {}

  /** GET /api/bills?projectId=… */
  @Get('bills')
  async list(@User() user: CurrentUser, @Query('projectId', new ParseUUIDPipe({ optional: true })) projectId?: string): Promise<ProjectBill[]> {
    const scope = await this.scopes.for(user);
    // An empty list rather than 403: the web app loads bills on every screen and simply shows none.
    return scope.finance ? scope.filter(await this.bills.list(projectId)) : [];
  }

  /** POST /api/projects/:projectId/bills */
  @Allow('bill.manage')
  @ProjectScope('projectId', 'projects')
  @Post('projects/:projectId/bills')
  create(
    @User() user: CurrentUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(BillInputSchema)) body: BillInput,
  ): Promise<ProjectBill> {
    return this.bills.create(projectId, body, user.employeeId);
  }

  /** PUT /api/bills/:id */
  @Allow('bill.manage')
  @ProjectScope('id', 'projectBills')
  @Put('bills/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(BillInputSchema)) body: BillInput): Promise<ProjectBill> {
    return this.bills.update(id, body);
  }

  /** DELETE /api/bills/:id (204) */
  @Allow('bill.manage')
  @ProjectScope('id', 'projectBills')
  @Delete('bills/:id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.bills.remove(id);
  }
}
