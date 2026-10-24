import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { signIn, type Api } from './helpers.js';

/** Sign-in, accounts, role permissions and the "your projects only" rule. */
describe('Auth and roles (e2e)', () => {
  let app: INestApplication;
  const raw = () => request(app.getHttpServer());
  const run = Date.now().toString(36);
  let admin: Api;
  let pm: { api: Api; employeeId: string };
  let otherPm: { api: Api; employeeId: string };
  let engineer: { api: Api; employeeId: string };
  let accounts: Api;
  let projectId: string;

  const project = (managerId: string, name: string) => ({
    name: `${name} ${run}`, clientName: `Client ${run}`, site: `Site ${run}`, projectType: 'Commissioning', managerId,
    contractValue: 1000000, estimatedCost: 780000, allottedManDays: 150, startDate: '2026-01-01', endDate: '2026-12-31', status: 'active',
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    admin = (await signIn(app, 'management')).api;
    pm = await signIn(app, 'project_manager');
    otherPm = await signIn(app, 'project_manager');
    engineer = await signIn(app, 'site_engineer');
    accounts = (await signIn(app, 'accounts')).api;
    projectId = (await admin().post('/api/projects').send(project(pm.employeeId, 'Phoenix Mall')).expect(201)).body.id;
    await admin().post(`/api/projects/${projectId}/assignments`).send({ employeeId: engineer.employeeId, role: 'Site Engineer', allocation: 100, startDate: '2026-01-05' }).expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses requests without a valid token, but not the health check', async () => {
    await raw().get('/api/projects').expect(401);
    await raw().get('/api/projects').set('Authorization', 'Bearer not-a-token').expect(401);
    await raw().get('/api/health').expect(200);
  });

  it('gives the same answer for an unknown email and a wrong password', async () => {
    const a = await raw().post('/api/auth/login').send({ email: `nobody.${run}@aerosyshvac.in`, password: 'whatever' }).expect(401);
    const emp = (await admin().post('/api/employees').send({ name: 'Login Probe', email: `probe.${run}@aerosyshvac.in`, department: 'Projects', designation: 'PM', dailyCost: 1, joiningDate: '2020-01-01' }).expect(201)).body;
    await admin().post('/api/users').send({ employeeId: emp.id, role: 'project_manager', password: 'start-here-1' }).expect(201);
    const b = await raw().post('/api/auth/login').send({ email: emp.email, password: 'wrong-password' }).expect(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('makes a new login pick a password before anything else', async () => {
    const emp = (await admin().post('/api/employees').send({ name: 'New Joiner', email: `new.${run}@aerosyshvac.in`, department: 'Engineering', designation: 'Engineer', dailyCost: 1, joiningDate: '2020-01-01', isSiteEngineer: true }).expect(201)).body;
    const created = await admin().post('/api/users').send({ employeeId: emp.id, role: 'site_engineer', password: 'start-here-1' }).expect(201);
    expect(created.body).toMatchObject({ role: 'site_engineer', mustChangePassword: true, email: emp.email });
    expect(created.body.passwordHash).toBeUndefined();
    await admin().post('/api/users').send({ employeeId: emp.id, role: 'site_engineer', password: 'start-here-1' }).expect(409);

    const login = await raw().post('/api/auth/login').send({ email: emp.email.toUpperCase(), password: 'start-here-1' }).expect(200);
    const bearer = `Bearer ${login.body.token}`;
    expect(login.body.user).toMatchObject({ employeeId: emp.id, mustChangePassword: true });
    await raw().get('/api/projects').set('Authorization', bearer).expect(403);
    await raw().get('/api/auth/me').set('Authorization', bearer).expect(200);
    await raw().post('/api/auth/change-password').set('Authorization', bearer).send({ currentPassword: 'nope', newPassword: 'my-own-pass-9' }).expect(401);
    await raw().post('/api/auth/change-password').set('Authorization', bearer).send({ currentPassword: 'start-here-1', newPassword: 'short' }).expect(400);
    await raw().post('/api/auth/change-password').set('Authorization', bearer).send({ currentPassword: 'start-here-1', newPassword: 'my-own-pass-9' }).expect(200);
    await raw().get('/api/projects').set('Authorization', bearer).expect(200);
  });

  it('switching a login off takes effect at once, even for a token already issued', async () => {
    const emp = (await admin().post('/api/employees').send({ name: 'Leaver', email: `leaver.${run}@aerosyshvac.in`, department: 'Accounts', designation: 'Exec', dailyCost: 1, joiningDate: '2020-01-01' }).expect(201)).body;
    const user = (await admin().post('/api/users').send({ employeeId: emp.id, role: 'accounts', password: 'start-here-1' }).expect(201)).body;
    const token = (await raw().post('/api/auth/login').send({ email: emp.email, password: 'start-here-1' }).expect(200)).body.token;
    await admin().put(`/api/users/${user.id}`).send({ role: 'accounts', active: false }).expect(200);
    await raw().get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    await raw().post('/api/auth/login').send({ email: emp.email, password: 'start-here-1' }).expect(401);
  });

  it('lets only Management manage Management logins', async () => {
    const emp = (await admin().post('/api/employees').send({ name: 'Would Be Director', email: `dir.${run}@aerosyshvac.in`, department: 'Management', designation: 'Director', dailyCost: 1, joiningDate: '2020-01-01' }).expect(201)).body;
    await accounts().post('/api/users').send({ employeeId: emp.id, role: 'management', password: 'start-here-1' }).expect(403);
    await admin().post('/api/users').send({ employeeId: emp.id, role: 'management', password: 'start-here-1' }).expect(201);
    await engineer.api().get('/api/users').expect(200);
    await engineer.api().post('/api/users').send({ employeeId: emp.id, role: 'accounts', password: 'start-here-1' }).expect(403);
  });

  it('checks the role on every change', async () => {
    await engineer.api().post('/api/projects').send(project(pm.employeeId, 'Not allowed')).expect(403);
    await accounts().put('/api/settings').send({ companyName: 'X', deadlineAlertDays: 14, hoursPerManDay: 8, projectionMethod: 'performance', targetMarginPct: 15 }).expect(403);
    await pm.api().delete(`/api/projects/${projectId}`).expect(403);
  });

  it('lets a project manager change only their own projects', async () => {
    const otherProject = (await admin().post('/api/projects').send(project(otherPm.employeeId, 'Orchid IT Park')).expect(201)).body.id;
    const item = { srNo: '1', description: 'Chilled water piping', uom: 'Rmt', contractQty: 100, rate: 1500 };
    await pm.api().post(`/api/projects/${projectId}/boq-items`).send(item).expect(201);
    await pm.api().post(`/api/projects/${otherProject}/boq-items`).send(item).expect(403);
    await pm.api().patch(`/api/projects/${otherProject}/status`).send({ status: 'on_hold' }).expect(403);
    // A missing row is still a 404, and a malformed id still a 400.
    await pm.api().delete('/api/boq-items/00000000-0000-4000-8000-000000000000').expect(404);
    await pm.api().delete('/api/boq-items/not-a-uuid').expect(400);
  });

  it('records the signed-in person as author', async () => {
    const log = await pm.api()
      .post(`/api/projects/${projectId}/daily-logs`)
      .send({ date: '2026-02-02', attendance: [{ employeeId: engineer.employeeId, status: 'on_site' }], createdById: engineer.employeeId })
      .expect(201);
    expect(log.body.createdById).toBe(pm.employeeId);
  });

  it('lets only Accounts record expenses, bills and other costs', async () => {
    const otherProject = (await admin().post('/api/projects').send(project(otherPm.employeeId, 'Sunrise Tower')).expect(201)).body.id;
    const claim = { projectId, employeeId: engineer.employeeId, category: 'Food', amount: 300, date: '2026-02-03' };
    for (const someone of [admin, pm.api, engineer.api]) {
      await someone().post('/api/expenses').send(claim).expect(403);
      await someone().post(`/api/projects/${projectId}/bills`).send({ kind: 'vendor_bill', number: `B-${run}`, party: 'Daikin', amount: 1000, date: '2026-02-03' }).expect(403);
      await someone().post(`/api/projects/${projectId}/costs`).send({ type: 'hire', description: 'Crane', amount: 1000, date: '2026-02-03' }).expect(403);
    }
    // Accounts records for anyone, on any project, and can remove a wrong entry.
    const recorded = await accounts().post('/api/expenses').send({ ...claim, projectId: otherProject }).expect(201);
    expect(recorded.body.status).toBeUndefined();
    await pm.api().delete(`/api/expenses/${recorded.body.id}`).expect(403);
    await accounts().delete(`/api/expenses/${recorded.body.id}`).expect(204);
    // The approve/reject routes are gone.
    await accounts().patch(`/api/expenses/${recorded.body.id}/approve`).send({}).expect(404);
  });
});
