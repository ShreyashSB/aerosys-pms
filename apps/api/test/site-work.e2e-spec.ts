import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { signIn, type Api } from './helpers.js';

/** Assignments, BOQ, daily logs and settings against a real Postgres. */
describe('Site work (e2e)', () => {
  let app: INestApplication;
  let api: Api;
  const run = Date.now().toString(36);
  let pmId: string;
  let engineerId: string;
  let techId: string;
  let projectId: string;
  let otherProjectId: string;
  let itemId: string;

  const employee = async (name: string, site = true) =>
    (
      await api()
        .post('/api/employees')
        .send({ name, email: `${name.toLowerCase().replace(/\s/g, '.')}.${run}@aerosyshvac.in`, department: site ? 'Engineering' : 'Projects', designation: 'Engineer', dailyCost: 2500, joiningDate: '2020-01-01', isSiteEngineer: site })
        .expect(201)
    ).body.id as string;

  const newProject = async (name: string) =>
    (
      await api()
        .post('/api/projects')
        .send({ name: `${name} ${run}`, clientName: `Client ${run}`, site: `Site ${run}`, projectType: 'Commissioning', managerId: pmId, contractValue: 1000000, estimatedCost: 780000, allottedManDays: 150, startDate: '2026-01-01', endDate: '2026-12-31', status: 'active' })
        .expect(201)
    ).body.id as string;

  const log = (over: Record<string, unknown> = {}) => ({
    date: '2026-03-02',
    attendance: [
      { employeeId: engineerId, status: 'on_site', idleHours: 2, idleReason: 'Material unavailable' },
      { employeeId: techId, status: 'leave' },
    ],
    activities: 'Chilled water piping',
    work: [{ boqItemId: itemId, qty: 40 }],
    ...over,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    ({ api } = await signIn(app));
    pmId = await employee('Farhan Shaikh', false);
    engineerId = await employee('Karan Mehta');
    techId = await employee('Suresh Yadav');
    projectId = await newProject('Phoenix Mall');
    otherProjectId = await newProject('Orchid IT Park');
  });

  afterAll(async () => {
    await app.close();
  });

  it('reads and updates settings', async () => {
    const s = await api().get('/api/settings').expect(200);
    expect(s.body).toMatchObject({ hoursPerManDay: 8, projectionMethod: 'performance' });
    await api().put('/api/settings').send({ ...s.body, targetMarginPct: 101 }).expect(400);
  });

  it('assigns an engineer once, and releases them', async () => {
    const a = await api().post(`/api/projects/${projectId}/assignments`).send({ employeeId: engineerId, role: 'Site Engineer', allocation: 100, startDate: '2026-01-05' }).expect(201);
    await api().post(`/api/projects/${projectId}/assignments`).send({ employeeId: engineerId, role: 'Technician', allocation: 50, startDate: '2026-02-01' }).expect(409);
    await api().post(`/api/projects/${projectId}/assignments`).send({ employeeId: techId, role: 'Technician', allocation: 0, startDate: '2026-02-01' }).expect(400);

    await api().delete(`/api/assignments/${a.body.id}`).expect(204);
    const list = await api().get(`/api/assignments?projectId=${projectId}`).expect(200);
    expect(list.body.find((x: { id: string }) => x.id === a.body.id).endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('keeps the BOQ: items, manual measurements and corrections', async () => {
    const item = await api().post(`/api/projects/${projectId}/boq-items`).send({ srNo: '1', description: 'Chilled water piping 150 NB', uom: 'Rmt', contractQty: 500, rate: 1850.5 }).expect(201);
    itemId = item.body.id;
    expect(item.body).toMatchObject({ contractQty: 500, rate: 1850.5 });

    const manual = await api().post(`/api/boq-items/${itemId}/executions`).send({ date: '2026-02-10', qty: 10 }).expect(201);
    await api().post(`/api/boq-items/${itemId}/executions`).send({ date: '2026-02-11', qty: -11 }).expect(400);
    await api().delete(`/api/boq-executions/${manual.body.id}`).expect(204);
  });

  it('saves a daily log with attendance and work, and lists it', async () => {
    const res = await api().post(`/api/projects/${projectId}/daily-logs`).send(log()).expect(201);
    expect(res.body.attendance).toEqual(
      expect.arrayContaining([
        { employeeId: engineerId, status: 'on_site', idleHours: 2, idleReason: 'Material unavailable' },
        // An off day carries no idle time.
        { employeeId: techId, status: 'leave', idleHours: 0, idleReason: null },
      ]),
    );
    const exe = await api().get(`/api/boq-executions?projectId=${projectId}`).expect(200);
    const fromLog = exe.body.filter((x: { dailyLogId: string | null }) => x.dailyLogId === res.body.id);
    expect(fromLog).toEqual([expect.objectContaining({ qty: 40, date: '2026-03-02' })]);

    // A daily-log quantity can't be deleted on its own.
    await api().delete(`/api/boq-executions/${fromLog[0].id}`).expect(400);
  });

  it('refuses a second log for the same date, and double booking across projects', async () => {
    await api().post(`/api/projects/${projectId}/daily-logs`).send(log({ work: [] })).expect(409);
    const clash = await api()
      .post(`/api/projects/${otherProjectId}/daily-logs`)
      .send(log({ work: [], attendance: [{ employeeId: engineerId, status: 'off_site' }] }))
      .expect(409);
    expect(clash.body.message).toContain('already logged as working');
    // Leave on one project and work on another is fine.
    await api()
      .post(`/api/projects/${otherProjectId}/daily-logs`)
      .send(log({ work: [], attendance: [{ employeeId: techId, status: 'on_site' }] }))
      .expect(201);
  });

  it('validates logs: future dates, idle reasons, other projects\' BOQ items', async () => {
    await api().post(`/api/projects/${projectId}/daily-logs`).send(log({ date: '2099-01-01' })).expect(400);
    const noReason = await api()
      .post(`/api/projects/${projectId}/daily-logs`)
      .send(log({ date: '2026-03-03', attendance: [{ employeeId: engineerId, status: 'idle' }] }))
      .expect(400);
    expect(noReason.body.errors[0].field).toBe('attendance.0.idleReason');
    await api().post(`/api/projects/${otherProjectId}/daily-logs`).send(log({ date: '2026-03-04', attendance: [{ employeeId: techId, status: 'on_site' }] })).expect(400);
  });

  it('edits a log by replacing its attendance and work, and deletes it', async () => {
    const created = await api().post(`/api/projects/${projectId}/daily-logs`).send(log({ date: '2026-03-05' })).expect(201);
    const edited = await api()
      .put(`/api/daily-logs/${created.body.id}`)
      .send(log({ date: '2026-03-05', attendance: [{ employeeId: engineerId, status: 'on_site' }], work: [{ boqItemId: itemId, qty: 25 }] }))
      .expect(200);
    expect(edited.body.attendance).toHaveLength(1);
    const exe = await api().get(`/api/boq-executions?projectId=${projectId}`).expect(200);
    expect(exe.body.filter((x: { dailyLogId: string }) => x.dailyLogId === created.body.id).map((x: { qty: number }) => x.qty)).toEqual([25]);

    await api().delete(`/api/daily-logs/${created.body.id}`).expect(204);
    const after = await api().get(`/api/boq-executions?projectId=${projectId}`).expect(200);
    expect(after.body.some((x: { dailyLogId: string }) => x.dailyLogId === created.body.id)).toBe(false);
  });

  it('completing a project ends open assignments and stops logging', async () => {
    await api().post(`/api/projects/${otherProjectId}/assignments`).send({ employeeId: techId, role: 'Technician', allocation: 50, startDate: '2026-01-10' }).expect(201);
    await api().patch(`/api/projects/${otherProjectId}/status`).send({ status: 'completed' }).expect(200);
    const list = await api().get(`/api/assignments?projectId=${otherProjectId}`).expect(200);
    expect(list.body.every((a: { endDate: string | null }) => a.endDate)).toBe(true);
    await api().post(`/api/projects/${otherProjectId}/daily-logs`).send(log({ date: '2026-03-06', work: [], attendance: [{ employeeId: techId, status: 'on_site' }] })).expect(400);
  });

  it('closes the measurement period', async () => {
    await api().post(`/api/projects/${projectId}/close-period`).expect(204);
    const p = await api().get(`/api/projects/${projectId}`).expect(200);
    expect(p.body.periodStart).not.toBe('2026-01-01');
  });
});
