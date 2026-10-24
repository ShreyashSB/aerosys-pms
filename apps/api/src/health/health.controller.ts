import { Controller, Get, Inject } from '@nestjs/common';
import { Public } from '../auth/current-user.js';
import { sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  time: string;
}

/**
 * GET /api/health — used by the hosting platform to check the app is alive,
 * and by us to check the database connection. Always answers 200 so a slow
 * database never makes the host restart a healthy server.
 */
@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get()
  async check(): Promise<HealthStatus> {
    let database: HealthStatus['database'] = 'up';
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      database = 'down';
    }
    return { status: database === 'up' ? 'ok' : 'degraded', database, time: new Date().toISOString() };
  }
}
