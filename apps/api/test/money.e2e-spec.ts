import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { signIn, type Api } from './helpers.js';

/** Expenses, bills & invoices and other project costs against a real Postgres. Accounts records all of them. */
describe('Money (e2e)', () => {
  let app: INestApplication;
  /** Management: sets up the employees and the project. */
  let admin: Api;
  /** Accounts: records the money. */
  let api: Api;
  const run = Date.now().toString(36);
  let pmId: string;
  let engineerId: string;
  let projectId: string;

  const employee = async (name: string) =>
    (
      await api()
        .post('/api/employees')
        .send({ name, email: `${name.toLowerCase().replace(/\s/g, '.')}.${run}@aerosyshvac.in`, department: 'Engineering', designation: 'Engineer', dailyCost: 2500, joiningDate: '2020-01-01' })
        .expect(201)
    ).body.id as string;

  const expense = (over: Record<string, unknown> = {}) => ({
    projectId,
    employeeId: engineerId,
    category: 'Travel',
    amount: 1250.5,
    date: '2026-03-02',
    description: 'Train to site',
    receipt: { fileName: 'ticket.pdf', size: 52000, mimeType: 'application/pdf' },
    ...over,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    admin = (await signIn(app)).api;
    api = (await signIn(app, 'accounts')).api;
    pmId = await employee('Farhan Shaikh');
    engineerId = await employee('Karan Mehta');
    projectId = (
      await admin()
        .post('/api/projects')
        .send({ name: `Phoenix Mall ${run}`, clientName: `Client ${run}`, site: `Site ${run}`, projectType: 'Commissioning', managerId: pmId, contractValue: 1000000, estimatedCost: 780000, allottedManDays: 150, startDate: '2026-01-01', endDate: '2026-12-31', status: 'active' })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('records an expense with the next EXP number', async () => {
    const a = await api().post('/api/expenses').send(expense()).expect(201);
    const b = await api().post('/api/expenses').send(expense({ amount: 300 })).expect(201);
    expect(a.body).toMatchObject({ amount: 1250.5, receipt: { fileName: 'ticket.pdf' } });
    expect(a.body.code).toMatch(/^EXP-\d+$/);
    expect(Number(b.body.code.slice(4))).toBe(Number(a.body.code.slice(4)) + 1);
  });

  it('rejects bad expenses', async () => {
    await api().post('/api/expenses').send(expense({ amount: 0 })).expect(400);
    await api().post('/api/expenses').send(expense({ category: 'Party' })).expect(400);
    await api().post('/api/expenses').send(expense({ date: '2999-01-01' })).expect(400);
    await api().post('/api/expenses').send(expense({ employeeId: '00000000-0000-4000-8000-000000000000' })).expect(400);
    await api().post('/api/expenses').send(expense({ projectId: '00000000-0000-4000-8000-000000000000' })).expect(404);
    await api().post('/api/expenses').send(expense({ receipt: { fileName: 'big.pdf', size: 20_000_000, mimeType: 'application/pdf' } })).expect(400);
  });

  it('deletes a wrong entry', async () => {
    const { body } = await api().post('/api/expenses').send(expense()).expect(201);
    await api().delete(`/api/expenses/${body.id}`).expect(204);
    await api().delete(`/api/expenses/${body.id}`).expect(404);
  });

  it('filters expenses by project', async () => {
    const { body } = await api().get(`/api/expenses?projectId=${projectId}`).expect(200);
    expect(body).toHaveLength(2);
    expect(body.every((e: { projectId: string }) => e.projectId === projectId)).toBe(true);
    await api().get('/api/expenses?projectId=nope').expect(400);
  });

  it('records bills and invoices, refusing a repeated number', async () => {
    const bill = { kind: 'client_invoice', number: 'INV-7', party: 'Phoenix Mills', amount: 250000, date: '2026-03-31', notes: 'RA bill 1' };
    const { body } = await api().post(`/api/projects/${projectId}/bills`).send(bill).expect(201);
    expect(body).toMatchObject({ kind: 'client_invoice', amount: 250000, attachment: null });
    // Same number with different case on the same project and kind.
    await api().post(`/api/projects/${projectId}/bills`).send({ ...bill, number: 'inv-7' }).expect(409);
    // The same number as a vendor bill is fine.
    await api().post(`/api/projects/${projectId}/bills`).send({ ...bill, kind: 'vendor_bill', party: 'Daikin' }).expect(201);
    const edited = await api().put(`/api/bills/${body.id}`).send({ ...bill, amount: 260000 }).expect(200);
    expect(edited.body.amount).toBe(260000);
    const list = await api().get(`/api/bills?projectId=${projectId}`).expect(200);
    expect(list.body).toHaveLength(2);
    await api().delete(`/api/bills/${body.id}`).expect(204);
    await api().delete(`/api/bills/${body.id}`).expect(404);
  });

  it('records other project costs', async () => {
    const { body } = await api().post(`/api/projects/${projectId}/costs`).send({ type: 'hire', description: 'Crane hire', amount: 18000, date: '2026-03-05' }).expect(201);
    expect(body).toMatchObject({ type: 'hire', amount: 18000 });
    await api().post(`/api/projects/${projectId}/costs`).send({ type: 'hire', description: '', amount: 1, date: '2026-03-05' }).expect(400);
    expect((await api().get(`/api/project-costs?projectId=${projectId}`).expect(200)).body).toHaveLength(1);
    await api().delete(`/api/project-costs/${body.id}`).expect(204);
  });

  it('deletes expenses, bills and costs with their project', async () => {
    await api().post(`/api/projects/${projectId}/costs`).send({ type: 'other', description: 'Scaffolding', amount: 5000, date: '2026-03-05' }).expect(201);
    await admin().delete(`/api/projects/${projectId}`).expect(204);
    expect((await api().get(`/api/expenses?projectId=${projectId}`).expect(200)).body).toHaveLength(0);
    expect((await api().get(`/api/bills?projectId=${projectId}`).expect(200)).body).toHaveLength(0);
    expect((await api().get(`/api/project-costs?projectId=${projectId}`).expect(200)).body).toHaveLength(0);
  });
});
