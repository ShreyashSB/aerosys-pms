import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { signIn, type Api } from './helpers.js';

type Note = { id: string; type: string; title: string; message: string; readBy: string[] };

/** Who gets told what, read/unread per person, and the deadline check. */
describe('Notifications (e2e)', () => {
  let app: INestApplication;
  const run = Date.now().toString(36);
  let admin: Api;
  let pm: { api: Api; employeeId: string };
  let otherPm: Api;
  let engineer: { api: Api; employeeId: string };
  let accounts: Api;
  let projectId: string;

  /** Only this run's notifications: other specs share the database. */
  const mine = async (api: Api): Promise<Note[]> => ((await api().get('/api/notifications').expect(200)).body as Note[]).filter((n) => n.message.includes(run));
  const titles = async (api: Api) => (await mine(api)).map((n) => n.title).sort();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    admin = (await signIn(app, 'management')).api;
    pm = await signIn(app, 'project_manager');
    otherPm = (await signIn(app, 'project_manager')).api;
    engineer = await signIn(app, 'site_engineer', `Engineer ${run}`);
    accounts = (await signIn(app, 'accounts')).api;
    projectId = (
      await admin()
        .post('/api/projects')
        .send({
          name: `Orbit Tower ${run}`, clientName: `Client ${run}`, site: `Site ${run}`, projectType: 'Commissioning', managerId: pm.employeeId,
          contractValue: 1000000, estimatedCost: 780000, allottedManDays: 150, startDate: '2026-01-01', endDate: '2099-12-31', status: 'active',
        })
        .expect(201)
    ).body.id;
    await admin().post(`/api/projects/${projectId}/assignments`).send({ employeeId: engineer.employeeId, role: 'Site Engineer', allocation: 100, startDate: '2026-01-05' }).expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('sends each event to the roles and people it concerns', async () => {
    const expense = (
      await engineer.api().post('/api/expenses').send({ projectId, employeeId: engineer.employeeId, category: 'Travel', amount: 1250, date: '2026-02-01', description: 'Cab' }).expect(201)
    ).body;
    await admin().patch(`/api/expenses/${expense.id}/reject`).send({ note: 'No receipt' }).expect(200);

    expect(await titles(admin)).toEqual(['Engineer assigned', 'Expense submitted for approval', 'New project created']);
    expect(await titles(accounts)).toEqual(['Expense submitted for approval', 'New project created']);
    // The PM hears about their own project; another PM hears nothing.
    expect(await titles(pm.api)).toEqual(['Engineer assigned', 'Expense submitted for approval', 'New project created']);
    expect(await titles(otherPm)).toEqual([]);
    // The engineer was assigned and had an expense rejected: they hear about both, by name.
    expect(await titles(engineer.api)).toEqual(['Engineer assigned', 'Expense rejected']);
    const rejected = (await mine(engineer.api)).find((n) => n.type === 'expense_rejected')!;
    expect(rejected.message).toContain('₹1,250');
    expect(rejected.message).toContain('No receipt');
  });

  it('keeps read/unread per person', async () => {
    const [first] = await mine(pm.api);
    await pm.api().post(`/api/notifications/${first.id}/read`).expect(204);
    await pm.api().post(`/api/notifications/${first.id}/read`).expect(204); // twice is fine
    expect((await mine(pm.api)).filter((n) => n.readBy.length)).toHaveLength(1);
    // Management saw the same notification but hasn't read it.
    expect((await mine(admin)).find((n) => n.id === first.id)?.readBy).toEqual([]);

    await admin().post('/api/notifications/read-all').expect(204);
    expect((await mine(admin)).every((n) => n.readBy.length === 1)).toBe(true);
    // Someone else's notification can't be marked: as far as they're concerned it doesn't exist.
    await otherPm().post(`/api/notifications/${first.id}/read`).expect(404);
  });

  it('raises milestone alerts when the BOQ crosses 90% and 100%', async () => {
    const item = (await admin().post(`/api/projects/${projectId}/boq-items`).send({ srNo: '1', description: 'Duct', uom: 'sqm', contractQty: 100, rate: 1000 }).expect(201)).body;
    await admin().post(`/api/boq-items/${item.id}/executions`).send({ date: '2026-02-01', qty: 50, remarks: '' }).expect(201);
    expect(await titles(accounts)).not.toContain('Project nearing completion');
    await admin().post(`/api/boq-items/${item.id}/executions`).send({ date: '2026-02-02', qty: 45, remarks: '' }).expect(201);
    await admin().post(`/api/boq-items/${item.id}/executions`).send({ date: '2026-02-03', qty: 5, remarks: '' }).expect(201);
    const t = await titles(accounts);
    expect(t).toContain('Project nearing completion');
    expect(t).toContain('BOQ fully executed');
  });

  it('warns about an approaching deadline once, however often the check runs', async () => {
    const soon = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const p = (
      await admin()
        .post('/api/projects')
        .send({
          name: `Deadline ${run}`, clientName: `Client ${run}`, site: `Site ${run}`, projectType: 'Commissioning', managerId: pm.employeeId,
          contractValue: 100000, estimatedCost: 80000, allottedManDays: 10, startDate: '2026-01-01', endDate: soon, status: 'active',
        })
        .expect(201)
    ).body;
    const checks = app.get(NotificationsService);
    await checks.runChecks();
    await checks.runChecks();
    const deadline = (await mine(pm.api)).filter((n) => n.type === 'project_deadline' && n.message.includes(p.name));
    expect(deadline).toHaveLength(1);
    expect(deadline[0].title).toBe('Project deadline approaching');
  });

  it('needs a sign-in', async () => {
    const request = (await import('supertest')).default;
    await request(app.getHttpServer()).get('/api/notifications').expect(401);
  });
});
