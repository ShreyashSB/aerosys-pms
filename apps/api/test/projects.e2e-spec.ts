import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { signIn, type Api } from './helpers.js';

/** Employees, projects and lookups against a real Postgres (see api.e2e-spec.ts). */
describe('Employees and projects (e2e)', () => {
  let app: INestApplication;
  let api: Api;
  // Unique per run, so the suite can run again on the same database.
  const run = Date.now().toString(36);
  let managerId: string;

  const project = (over: Record<string, unknown> = {}) => ({
    name: `Lotus Business Park ${run}`,
    clientName: `Lotus Infra ${run}`,
    site: `Baner ${run}`,
    projectType: 'TAB (Testing, Adjusting, Balancing)',
    workOrderNo: 'WO/LIP/2026/007',
    managerId,
    contractValue: 2500000,
    estimatedCost: 1950000,
    allottedManDays: 300,
    startDate: '2026-11-01',
    endDate: '2027-04-30',
    ...over,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    ({ api } = await signIn(app));

    const res = await api()
      .post('/api/employees')
      .send({
        name: 'Anita Deshpande',
        email: `anita.${run}@aerosyshvac.in`,
        department: 'Projects',
        designation: 'Senior Project Manager',
        dailyCost: 5500,
        joiningDate: '2016-01-11',
      })
      .expect(201);
    managerId = res.body.id;
    expect(res.body.code).toMatch(/^EMP-\d{3,}$/);
    expect(res.body.dailyCost).toBe(5500);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a second employee with the same email (409)', async () => {
    await api()
      .post('/api/employees')
      .send({ name: 'Someone Else', email: `ANITA.${run}@aerosyshvac.in`, department: 'Projects', designation: 'PM', dailyCost: 1, joiningDate: '2020-01-01' })
      .expect(409);
  });

  it('creates a project, adding a new client and site to the dropdown lists', async () => {
    const res = await api().post('/api/projects').send(project()).expect(201);
    expect(res.body).toMatchObject({
      code: expect.stringMatching(/^PRJ-2026-\d{3}$/),
      clientName: `Lotus Infra ${run}`,
      site: `Baner ${run}`,
      projectType: 'TAB (Testing, Adjusting, Balancing)',
      operationalCostPerManDay: 150,
      periodStart: '2026-11-01',
      status: 'planning',
    });

    const lookups = await api().get('/api/lookups').expect(200);
    expect(lookups.body.clients).toContain(`Lotus Infra ${run}`);
    expect(lookups.body.sites).toContain(`Baner ${run}`);
    expect(lookups.body.projectTypes).toEqual(expect.arrayContaining(['Commissioning', 'Audit']));
  });

  it('reuses an existing client when the name differs only in case', async () => {
    await api()
      .post('/api/projects')
      .send(project({ name: `Second job ${run}`, clientName: `LOTUS INFRA ${run}`, code: `TEST-${run}` }))
      .expect(201);
    const lookups = await api().get('/api/lookups').expect(200);
    expect(lookups.body.clients.filter((c: string) => c.toLowerCase() === `lotus infra ${run}`)).toHaveLength(1);
  });

  it('refuses a project ID that is already in use (409)', async () => {
    await api().post('/api/projects').send(project({ code: `TEST-${run}` })).expect(409);
  });

  it('validates the body (400) and checks the manager exists', async () => {
    const bad = await api().post('/api/projects').send(project({ endDate: '2026-01-01' })).expect(400);
    expect(bad.body.errors).toEqual([expect.objectContaining({ field: 'endDate' })]);
    await api()
      .post('/api/projects')
      .send(project({ managerId: '00000000-0000-4000-8000-000000000000' }))
      .expect(400);
  });

  it('updates, changes status and deletes a project', async () => {
    const created = await api().post('/api/projects').send(project({ name: `Edit me ${run}` })).expect(201);
    const id = created.body.id;

    const updated = await api()
      .put(`/api/projects/${id}`)
      .send(project({ name: `Edited ${run}`, projectType: `Retro-commissioning ${run}`, operationalCostPerManDay: 200 }))
      .expect(200);
    expect(updated.body).toMatchObject({ name: `Edited ${run}`, projectType: `Retro-commissioning ${run}`, operationalCostPerManDay: 200, code: created.body.code });

    await api().patch(`/api/projects/${id}/status`).send({ status: 'active' }).expect(200);
    expect((await api().get(`/api/projects/${id}`).expect(200)).body.status).toBe('active');

    await api().delete(`/api/projects/${id}`).expect(204);
    await api().get(`/api/projects/${id}`).expect(404);
  });

  it('answers 400 for a malformed id', async () => {
    await api().get('/api/projects/not-a-uuid').expect(400);
  });
});
