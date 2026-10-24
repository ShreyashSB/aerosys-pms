import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import request from 'supertest';
import { DEMO_PASSWORD, seedDemo } from '../scripts/seed-demo.js';
import { AppModule } from '../src/app.module.js';
import type { Api } from './helpers.js';
import * as schema from '../src/db/schema.js';

/**
 * Loads the full demo into the test database. This proves every demo row
 * passes the database's rules (foreign keys, unique and check constraints),
 * and that the API reads it back the way the web app expects.
 */
describe('Demo seed (e2e)', () => {
  let app: INestApplication;
  let api: Api;
  let counts: Awaited<ReturnType<typeof seedDemo>>;

  beforeAll(async () => {
    const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
    try {
      counts = await seedDemo(drizzle(client, { schema }));
    } finally {
      await client.end();
    }
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    // Sign in as a demo Management user: proves the seeded logins work.
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'rajesh.kulkarni@aerosyshvac.in', password: DEMO_PASSWORD }).expect(200);
    expect(login.body.user).toMatchObject({ role: 'management', name: 'Rajesh Kulkarni', mustChangePassword: false });
    api = () => request.agent(app.getHttpServer()).set('Authorization', `Bearer ${login.body.token}`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('loads every employee, login, project and instrument', async () => {
    expect((await api().get('/api/users').expect(200)).body).toHaveLength(counts.users);
    expect((await api().get('/api/employees').expect(200)).body).toHaveLength(counts.employees);
    const projects = (await api().get('/api/projects').expect(200)).body;
    expect(projects).toHaveLength(counts.projects);
    expect(projects.find((p: { name: string }) => p.name === 'Phoenix Mall HVAC Retrofit')).toMatchObject({
      clientName: 'Phoenix Marketcity Developers',
      projectType: 'Commissioning',
      status: 'active',
    });
    expect((await api().get('/api/lookups').expect(200)).body.projectTypes).toContain('Audit');
  });

  it('works out instrument status from the open deployments', async () => {
    const instruments = (await api().get('/api/instruments').expect(200)).body as Array<{ status: string; assignedProjectId: string | null }>;
    expect(instruments).toHaveLength(counts.instruments);
    const out = instruments.filter((i) => i.status === 'assigned');
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((i) => i.assignedProjectId)).toBe(true);
    expect(instruments.filter((i) => i.status === 'maintenance')).toHaveLength(1);
  });

  it('reads daily logs with attendance and keeps numbering expenses after the demo', async () => {
    const logs = (await api().get('/api/daily-logs').expect(200)).body;
    expect(logs).toHaveLength(counts.dailyLogs);
    expect(logs[0].attendance.length).toBeGreaterThan(0);
    const expenses = (await api().get('/api/expenses').expect(200)).body as Array<{ code: string; projectId: string; employeeId: string }>;
    expect(expenses).toHaveLength(counts.expenses);
    const max = Math.max(...expenses.map((e) => Number(e.code.slice(4))));
    const next = await api()
      .post('/api/expenses')
      .send({ projectId: expenses[0]!.projectId, employeeId: expenses[0]!.employeeId, category: 'Food', amount: 500, date: '2026-01-15' })
      .expect(201);
    expect(Number(next.body.code.slice(4))).toBe(max + 1);
  });
});
