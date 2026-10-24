import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
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
  @Post('instruments')
  create(@Body(new ZodValidationPipe(InstrumentInputSchema)) body: InstrumentInput): Promise<InstrumentDto> {
    return this.instruments.create(body);
  }

  /** PUT /api/instruments/:id */
  @Put('instruments/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(InstrumentInputSchema)) body: InstrumentInput): Promise<InstrumentDto> {
    return this.instruments.update(id, body);
  }

  /** POST /api/instruments/:id/assign */
  @Post('instruments/:id/assign')
  assign(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(IssueInputSchema)) body: IssueInput): Promise<InstrumentDto> {
    return this.instruments.assign(id, body);
  }

  /** POST /api/instruments/:id/return */
  @Post('instruments/:id/return')
  returnInstrument(@Param('id', ParseUUIDPipe) id: string): Promise<InstrumentDto> {
    return this.instruments.returnInstrument(id);
  }

  /** PATCH /api/instruments/:id/status */
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
