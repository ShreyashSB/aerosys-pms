import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { signIn, type Api } from './helpers.js';

/** What each role gets back from GET routes: rows from their projects only, and no money they shouldn't see. */
describe('Read scoping (e2e)', () => {
  let app: INestApplication;
  const run = Date.now().toString(36);
  let admin: Api;
  let accounts: Api;
  let pm: { api: Api; employeeId: string };
  let engineer: { api: Api; employeeId: string };
  let mine: string; // the engineer is assigned here
  let other: string; // and not here
  let otherLogId: string;

  const project = async (name: string) =>
    (
      await admin()
        .post('/api/projects')
        .send({
          name: `${name} ${run}`, clientName: `Client ${run}`, site: `Site ${run}`, projectType: 'Commissioning', managerId: pm.employeeId,
          contractValue: 1000000, estimatedCost: 780000, allottedManDays: 150, allottedExpenses: 50000, startDate: '2026-01-01', endDate: '2099-12-31', status: 'active',
        })
        .expect(201)
    ).body.id as string;
  const ids = (rows: Array<{ projectId: string }>) => [...new Set(rows.map((r) => r.projectId).filter((id) => id === mine || id === other))].sort();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    admin = (await signIn(app, 'management')).api;
    accounts = (await signIn(app, 'accounts')).api;
    pm = await signIn(app, 'project_manager');
    engineer = await signIn(app, 'site_engineer');
    mine = await project('Mine');
    other = await project('Other');
    await admin().post(`/api/projects/${mine}/assignments`).send({ employeeId: engineer.employeeId, role: 'Site Engineer', allocation: 100, startDate: '2026-01-05' }).expect(201);
    for (const p of [mine, other]) {
      await admin().post(`/api/projects/${p}/boq-items`).send({ srNo: '1', description: 'Duct', uom: 'sqm', contractQty: 100, rate: 1000 }).expect(201);
      await accounts().post(`/api/projects/${p}/bills`).send({ kind: 'vendor_bill', number: `B-${run}`, party: 'Daikin', amount: 1000, date: '2026-02-03' }).expect(201);
      await accounts().post('/api/expenses').send({ projectId: p, employeeId: p === mine ? engineer.employeeId : pm.employeeId, category: 'Food', amount: 300, date: '2026-02-03' }).expect(201);
    }
    await admin().post(`/api/projects/${mine}/daily-logs`).send({ date: '2026-02-02', attendance: [{ employeeId: engineer.employeeId, status: 'on_site' }] }).expect(201);
    otherLogId = (await admin().post(`/api/projects/${other}/daily-logs`).send({ date: '2026-02-02', attendance: [{ employeeId: pm.employeeId, status: 'on_site' }] }).expect(201)).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('shows a site engineer only the projects they work on', async () => {
    const api = engineer.api;
    const projects = (await api().get('/api/projects').expect(200)).body as Array<{ id: string; contractValue: number; allottedManDays: number }>;
    expect(projects.map((p) => p.id)).toContain(mine);
    expect(projects.map((p) => p.id)).not.toContain(other);
    await api().get(`/api/projects/${other}`).expect(404);
    await api().get(`/api/daily-logs/${otherLogId}`).expect(404);

    for (const route of ['/api/assignments', '/api/boq-items', '/api/daily-logs']) {
      expect(ids((await api().get(route).expect(200)).body)).toEqual([mine]);
    }
    // Only expenses spent in their own name.
    const expenses = (await api().get('/api/expenses').expect(200)).body as Array<{ employeeId: string }>;
    expect(expenses.length).toBeGreaterThan(0);
    expect(expenses.every((e) => e.employeeId === engineer.employeeId)).toBe(true);
  });

  it('blanks money for a role without finance or rate access', async () => {
    const api = engineer.api;
    const p = (await api().get(`/api/projects/${mine}`).expect(200)).body;
    expect(p).toMatchObject({ contractValue: 0, estimatedCost: 0, allottedExpenses: 0, allottedManDays: 150 });
    expect((await api().get('/api/bills').expect(200)).body).toEqual([]);
    expect((await api().get('/api/project-costs').expect(200)).body).toEqual([]);
    expect((await api().get('/api/engineer-reviews').expect(200)).body).toEqual([]);
    const employees = (await api().get('/api/employees').expect(200)).body as Array<{ dailyCost: number }>;
    expect(employees.every((e) => e.dailyCost === 0)).toBe(true);
  });

  it('leaves the other roles their full view', async () => {
    for (const api of [admin, accounts, pm.api]) {
      expect(ids((await api().get('/api/boq-items').expect(200)).body)).toEqual([mine, other].sort());
      expect((await api().get(`/api/projects/${other}`).expect(200)).body.contractValue).toBe(1000000);
      expect(ids((await api().get('/api/bills').expect(200)).body)).toEqual([mine, other].sort());
    }
    const employees = (await pm.api().get('/api/employees').expect(200)).body as Array<{ id: string; dailyCost: number }>;
    expect(employees.find((e) => e.id === engineer.employeeId)!.dailyCost).toBe(1000);
  });
});
