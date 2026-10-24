import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Allow, User, type CurrentUser } from '../auth/current-user.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { InstrumentDeployment } from '../db/schema.js';
import {
  DeploymentQuerySchema,
  InstrumentInputSchema,
  IssueInputSchema,
  StatusInputSchema,
  type DeploymentQuery,
  type InstrumentDto,
  type InstrumentInput,
  type IssueInput,
  type StatusInput,
} from './instruments.dto.js';
import { InstrumentsService } from './instruments.service.js';

@Controller()
export class InstrumentsController {
  constructor(private readonly instruments: InstrumentsService) {}

  /** GET /api/instruments */
  @Get('instruments')
  list(): Promise<InstrumentDto[]> {
    return this.instruments.list();
  }

  /** GET /api/instruments/:id */
  @Get('instruments/:id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<InstrumentDto> {
    return this.instruments.get(id);
  }

  /** POST /api/instruments */
  @Allow('instrument.manage')
  @Post('instruments')
  create(@Body(new ZodValidationPipe(InstrumentInputSchema)) body: InstrumentInput): Promise<InstrumentDto> {
    return this.instruments.create(body);
  }

  /** PUT /api/instruments/:id */
  @Allow('instrument.manage')
  @Put('instruments/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(InstrumentInputSchema)) body: InstrumentInput): Promise<InstrumentDto> {
    return this.instruments.update(id, body);
  }

  /** POST /api/instruments/:id/assign */
  @Allow('instrument.manage')
  @Post('instruments/:id/assign')
  assign(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(IssueInputSchema)) body: IssueInput,
  ): Promise<InstrumentDto> {
    return this.instruments.assign(id, body, user);
  }

  /** POST /api/instruments/:id/return */
  @Allow('instrument.manage')
  @Post('instruments/:id/return')
  returnInstrument(@Param('id', ParseUUIDPipe) id: string): Promise<InstrumentDto> {
    return this.instruments.returnInstrument(id);
  }

  /** PATCH /api/instruments/:id/status */
  @Allow('instrument.manage')
  @Patch('instruments/:id/status')
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(StatusInputSchema)) body: StatusInput): Promise<InstrumentDto> {
    return this.instruments.setStatus(id, body);
  }

  /** GET /api/instrument-deployments?projectId=…&instrumentId=… */
  @Get('instrument-deployments')
  listDeployments(@Query(new ZodValidationPipe(DeploymentQuerySchema)) q: DeploymentQuery): Promise<InstrumentDeployment[]> {
    return this.instruments.listDeployments(q);
  }
}
