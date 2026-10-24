import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { todayIST } from '../src/common/dates.js';

/** Instruments and their deployments, project documents and PM reviews against a real Postgres. */
describe('Instruments, documents and reviews (e2e)', () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());
  const run = Date.now().toString(36);
  let pmId: string;
  let engineerId: string;
  let projectId: string;
  let otherProjectId: string;

  const employee = async (name: string) =>
    (
      await api()
        .post('/api/employees')
        .send({ name, email: `${name.toLowerCase().replace(/\s/g, '.')}.${run}@aerosyshvac.in`, department: 'Engineering', designation: 'Engineer', dailyCost: 2500, joiningDate: '2020-01-01' })
        .expect(201)
    ).body.id as string;

  const newProject = async (name: string) =>
    (
      await api()
        .post('/api/projects')
        .send({ name: `${name} ${run}`, clientName: `Client ${run}`, site: `Site ${run}`, projectType: 'Commissioning', managerId: pmId, contractValue: 1000000, estimatedCost: 780000, allottedManDays: 150, startDate: '2026-01-01', endDate: '2026-12-31', status: 'active' })
        .expect(201)
    ).body.id as string;

  const instrument = (over: Record<string, unknown> = {}) => ({
    name: 'Anemometer',
    serialNumber: `AN-${run}`,
    category: 'Air Balancing',
    assetValue: 48000,
    purchaseDate: '2024-04-01',
    endOfLifeDate: '2029-03-31',
    currentLocation: 'Mumbai store',
    calibration: { fileName: 'cal.pdf', size: 90000, mimeType: 'application/pdf', validUntil: '2027-04-01' },
    ...over,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    pmId = await employee('Farhan Shaikh');
    engineerId = await employee('Karan Mehta');
    projectId = await newProject('Phoenix Mall');
    otherProjectId = await newProject('Orchid IT Park');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('instruments', () => {
    let id: string;

    it('creates an instrument with the next INS code, refusing a repeated serial number', async () => {
      const { body } = await api().post('/api/instruments').send(instrument()).expect(201);
      expect(body).toMatchObject({ status: 'available', assignedEngineerId: null, assignedProjectId: null, calibration: { validUntil: '2027-04-01' } });
      expect(body.code).toMatch(/^INS-\d{3,}$/);
      id = body.id;
      await api().post('/api/instruments').send(instrument({ serialNumber: `an-${run}` })).expect(409);
      await api().post('/api/instruments').send(instrument({ serialNumber: `X-${run}`, endOfLifeDate: '2024-01-01' })).expect(400);
    });

    it('issues an instrument and moves it to another project', async () => {
      const issued = await api().post(`/api/instruments/${id}/assign`).send({ engineerId, projectId }).expect(201);
      expect(issued.body).toMatchObject({ status: 'assigned', assignedEngineerId: engineerId, assignedProjectId: projectId });
      const moved = await api().post(`/api/instruments/${id}/assign`).send({ engineerId, projectId: otherProjectId }).expect(201);
      expect(moved.body.assignedProjectId).toBe(otherProjectId);
      const history = await api().get(`/api/instrument-deployments?instrumentId=${id}`).expect(200);
      expect(history.body).toHaveLength(2);
      expect(history.body.filter((d: { returnedAt: string | null }) => d.returnedAt === null)).toHaveLength(1);
      expect(history.body.find((d: { projectId: string }) => d.projectId === projectId).returnedAt).toBe(todayIST());
    });

    it('returns it, and blocks issuing one under maintenance', async () => {
      const back = await api().post(`/api/instruments/${id}/return`).expect(201);
      expect(back.body).toMatchObject({ status: 'available', assignedProjectId: null });
      await api().post(`/api/instruments/${id}/return`).expect(400);
      const m = await api().patch(`/api/instruments/${id}/status`).send({ status: 'maintenance', notes: 'Sensor drift' }).expect(200);
      expect(m.body).toMatchObject({ status: 'maintenance', notes: 'Sensor drift' });
      await api().post(`/api/instruments/${id}/assign`).send({ engineerId, projectId }).expect(400);
      await api().patch(`/api/instruments/${id}/status`).send({ status: 'assigned' }).expect(400);
    });

    it('edits an instrument and keeps its code when none is sent', async () => {
      const before = (await api().get(`/api/instruments/${id}`).expect(200)).body;
      const { body } = await api().put(`/api/instruments/${id}`).send(instrument({ assetValue: 52000, calibration: null })).expect(200);
      expect(body).toMatchObject({ code: before.code, assetValue: 52000, calibration: null, status: 'maintenance' });
    });
  });

  describe('documents', () => {
    it('records, lists and deletes project documents', async () => {
      const doc = { name: 'WO-4471.pdf', type: 'Work Order', size: 240000, mimeType: 'application/pdf', uploadedById: pmId };
      const { body } = await api().post(`/api/projects/${projectId}/documents`).send(doc).expect(201);
      expect(body).toMatchObject({ name: 'WO-4471.pdf', projectId });
      await api().post(`/api/projects/${projectId}/documents`).send({ ...doc, size: 30 * 1024 * 1024 }).expect(400);
      await api().post(`/api/projects/${projectId}/documents`).send({ ...doc, type: 'Invoice' }).expect(400);
      expect((await api().get(`/api/documents?projectId=${projectId}`).expect(200)).body).toHaveLength(1);
      await api().delete(`/api/documents/${body.id}`).expect(204);
      await api().delete(`/api/documents/${body.id}`).expect(404);
    });
  });

  describe('PM reviews', () => {
    const reviews = (rating: number, comments = 'Good work') => ({ reviewerId: pmId, reviews: [{ employeeId: engineerId, rating, comments }] });

    it('waits until the project is completed', async () => {
      await api().put(`/api/projects/${projectId}/reviews`).send(reviews(4)).expect(400);
    });

    it('saves a review, and updates it instead of adding a second', async () => {
      await api().patch(`/api/projects/${projectId}/status`).send({ status: 'completed' }).expect(200);
      const first = await api().put(`/api/projects/${projectId}/reviews`).send(reviews(4)).expect(200);
      expect(first.body).toEqual([expect.objectContaining({ employeeId: engineerId, rating: 4, reviewerId: pmId })]);
      const second = await api().put(`/api/projects/${projectId}/reviews`).send(reviews(5, 'Excellent')).expect(200);
      expect(second.body[0]).toMatchObject({ id: first.body[0].id, rating: 5, comments: 'Excellent' });
      const list = await api().get(`/api/engineer-reviews?employeeId=${engineerId}`).expect(200);
      expect(list.body).toHaveLength(1);
    });

    it('rejects bad ratings and duplicate engineers', async () => {
      await api().put(`/api/projects/${projectId}/reviews`).send(reviews(6)).expect(400);
      await api()
        .put(`/api/projects/${projectId}/reviews`)
        .send({ reviewerId: pmId, reviews: [{ employeeId: engineerId, rating: 3 }, { employeeId: engineerId, rating: 4 }] })
        .expect(400);
      await api()
        .put(`/api/projects/${projectId}/reviews`)
        .send({ reviewerId: pmId, reviews: [{ employeeId: '00000000-0000-4000-8000-000000000000', rating: 3 }] })
        .expect(400);
    });
  });
});
