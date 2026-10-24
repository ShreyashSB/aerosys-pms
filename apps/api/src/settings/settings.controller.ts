import { Body, Controller, Get, Put } from '@nestjs/common';
import { Allow } from '../auth/current-user.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { Settings } from '../db/schema.js';
import { SettingsInputSchema, type SettingsInput } from './settings.dto.js';
import { SettingsService } from './settings.service.js';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** GET /api/settings */
  @Get()
  get(): Promise<Settings> {
    return this.settings.get();
  }

  /** PUT /api/settings */
  @Allow('settings.manage')
  @Put()
  update(@Body(new ZodValidationPipe(SettingsInputSchema)) body: SettingsInput): Promise<Settings> {
    return this.settings.update(body);
  }
}
