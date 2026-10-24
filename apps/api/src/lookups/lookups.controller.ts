import { Controller, Get } from '@nestjs/common';
import { LookupsService, type Lookups } from './lookups.service.js';

@Controller('lookups')
export class LookupsController {
  constructor(private readonly lookups: LookupsService) {}

  /** GET /api/lookups → { clients: [...], sites: [...], projectTypes: [...] } */
  @Get()
  list(): Promise<Lookups> {
    return this.lookups.list();
  }
}
