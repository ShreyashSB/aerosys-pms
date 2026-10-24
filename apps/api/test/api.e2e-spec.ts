import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { runMigrations } from '../src/db/migrate.js';

/**
 * End-to-end tests: the real app against a real Postgres.
 * Needs DATABASE_URL pointing at a throwaway database (CI starts one).
 */
describe('API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await runMigrations(process.env.DATABASE_URL!);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health reports the database up', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('POST /api/clients creates a client once, even if added twice', async () => {
    const name = `E2E Client ${Date.now()}`;
    const first = await request(app.getHttpServer()).post('/api/clients').send({ name }).expect(201);
    const again = await request(app.getHttpServer())
      .post('/api/clients')
      .send({ name: name.toUpperCase() })
      .expect(201);
    expect(again.body.id).toBe(first.body.id);

    const list = await request(app.getHttpServer()).get('/api/clients').expect(200);
    expect(list.body.filter((c: { name: string }) => c.name === name)).toHaveLength(1);
  });

  it('POST /api/clients rejects a too-short name with 400', async () => {
    await request(app.getHttpServer()).post('/api/clients').send({ name: 'A' }).expect(400);
  });
});
