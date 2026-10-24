import type { Database } from '../db/db.module.js';
import { HealthController } from './health.controller.js';

// A fake database: unit tests check our logic without needing Postgres.
const fakeDb = (works: boolean) =>
  ({ execute: () => (works ? Promise.resolve([]) : Promise.reject(new Error('down'))) }) as unknown as Database;

describe('HealthController', () => {
  it('reports ok when the database answers', async () => {
    await expect(new HealthController(fakeDb(true)).check()).resolves.toMatchObject({ status: 'ok', database: 'up' });
  });

  it('reports degraded, not an error, when the database is down', async () => {
    await expect(new HealthController(fakeDb(false)).check()).resolves.toMatchObject({
      status: 'degraded',
      database: 'down',
    });
  });
});
