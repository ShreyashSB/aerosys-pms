import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { settings, type Settings } from '../db/schema.js';
import type { SettingsInput } from './settings.dto.js';

/** Reads and writes the one settings row (id = 1, created by migration 0003). */
@Injectable()
export class SettingsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async get(): Promise<Settings> {
    const [row] = await this.db.select().from(settings).where(eq(settings.id, 1));
    return row;
  }

  async update(input: SettingsInput): Promise<Settings> {
    const [row] = await this.db.update(settings).set(input).where(eq(settings.id, 1)).returning();
    return row;
  }
}
