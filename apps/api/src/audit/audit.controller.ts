import { Controller, Get, Query } from '@nestjs/common';
import { Allow } from '../auth/current-user.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { HistoryQuerySchema, type HistoryQuery } from './audit.dto.js';
import { AuditService, type HistoryPage } from './audit.service.js';

@Controller('history')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** GET /api/history?projectId=…&entity=…&actorId=…&from=…&to=…&q=…&before=… */
  @Allow('history.view')
  @Get()
  list(@Query(new ZodValidationPipe(HistoryQuerySchema)) q: HistoryQuery): Promise<HistoryPage> {
    return this.audit.list(q);
  }
}
