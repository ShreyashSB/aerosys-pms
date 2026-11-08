import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { diff } from '../src/audit/audit.js';
import { signIn, type Api } from './helpers.js';

interface Entry {
  entity: string;
  entityId: string;
  entityLabel: string;
  action: string;
  actorName: string;
  projectId: string | null;
  projectLabel: string | null;
  summary: string | null;
  changes: { field: string; from: unknown; to: unknown }[];
}

/** The change history: who changed what and when, recorded by @Audit routes. */
describe('Change history (e2e)', () => {
  let app: INestApplication;
  let api: Api;
  let engineer: Api;
  const run = Date.now().toString(36);
  let empId: string;
  let projectId: string;

  const history = async (query: Record<string, string>) =>
    (await api().get('/api/history').query(query).expect(200)).body as { entries: Entry[]; nextCursor: string | null };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    ({ api } = await signIn(app, 'management', `Meera Joshi ${run}`));
    ({ api: engineer } = await signIn(app, 'site_engineer'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('records a new employee and a rate change, with who did it', async () => {
    const emp = {
      name: `Ravi Kulkarni ${run}`,
      email: `ravi.${run}@aerosyshvac.in`,
      department: 'Engineering',
      designation: 'Site Engineer',
      dailyCost: 2200,
      joiningDate: '2021-04-01',
      isSiteEngineer: true,
    };
    empId = (await api().post('/api/employees').send(emp).expect(201)).body.id;
    await api().put(`/api/employees/${empId}`).send({ ...emp, dailyCost: 2600 }).expect(200);
    // Saving the form without changing anything adds nothing.
    await api().put(`/api/employees/${empId}`).send({ ...emp, dailyCost: 2600 }).expect(200);

    const { entries } = await history({ entity: 'employee', entityId: empId });
    expect(entries.map((e) => e.action)).toEqual(['update', 'create']);
    expect(entries[0]).toMatchObject({ actorName: `Meera Joshi ${run}`, changes: [{ field: 'dailyCost', from: 2200, to: 2600 }] });
    expect(entries[0].entityLabel).toContain(`Ravi Kulkarni ${run}`);
    expect(entries[1].changes).toContainEqual({ field: 'dailyCost', from: null, to: 2200 });
  });

  it('records project edits with names instead of ids, and keeps them after the project is deleted', async () => {
    const body = {
      name: `Silver Oak ${run}`,
      clientName: `Silver Oak Realty ${run}`,
      site: `Kharadi ${run}`,
      projectType: 'Commissioning',
      managerId: empId,
      contractValue: 1500000,
      estimatedCost: 1200000,
      allottedManDays: 200,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    };
    projectId = (await api().post('/api/projects').send(body).expect(201)).body.id;
    await api().put(`/api/projects/${projectId}`).send({ ...body, contractValue: 1650000 }).expect(200);

    const created = (await history({ projectId, action: 'create' })).entries[0];
    expect(created.changes).toContainEqual({ field: 'manager', from: null, to: `Ravi Kulkarni ${run}` });
    expect(created.projectLabel).toContain(`Silver Oak ${run}`);

    await api().delete(`/api/projects/${projectId}`).expect(204);
    const { entries } = await history({ projectId });
    expect(entries.map((e) => e.action)).toEqual(['delete', 'update', 'create']);
    expect(entries[1].changes).toEqual([{ field: 'contractValue', from: 1500000, to: 1650000 }]);
    expect(entries[0].changes).toContainEqual({ field: 'contractValue', from: 1650000, to: null });
  });

  it('records settings changes', async () => {
    const s = (await api().get('/api/settings').expect(200)).body;
    await api().put('/api/settings').send({ ...s, targetMarginPct: 22 }).expect(200);
    await api().put('/api/settings').send({ ...s, targetMarginPct: s.targetMarginPct }).expect(200);
    const { entries } = await history({ entity: 'settings' });
    expect(entries[0].changes).toEqual([{ field: 'targetMarginPct', from: 22, to: s.targetMarginPct }]);
    expect(entries[1].changes).toEqual([{ field: 'targetMarginPct', from: s.targetMarginPct, to: 22 }]);
  });

  it('saves nothing when the change is refused', async () => {
    const before = (await history({ entity: 'employee', entityId: empId })).entries.length;
    await engineer().put(`/api/employees/${empId}`).send({}).expect(403);
    await api().put(`/api/employees/${empId}`).send({ name: '' }).expect(400);
    expect((await history({ entity: 'employee', entityId: empId })).entries).toHaveLength(before);
  });

  it('searches and pages through the history', async () => {
    const found = await history({ q: `Ravi Kulkarni ${run}` });
    expect(found.entries.length).toBeGreaterThanOrEqual(2);

    const first = await history({ limit: '2' });
    expect(first.entries).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    const second = await history({ limit: '2', before: first.nextCursor! });
    const ids = (p: { entries: Entry[] }) => p.entries.map((e) => `${e.entityId}${e.action}${JSON.stringify(e.changes)}`);
    expect(ids(second).some((x) => ids(first).includes(x))).toBe(false);
  });

  it('is not open to site engineers', async () => {
    await engineer().get('/api/history').expect(403);
  });
});

describe('diff', () => {
  it('lists only changed fields, and leaves blanks out of creates', () => {
    expect(diff({ a: 1, b: 'x' }, { a: 2, b: 'x' })).toEqual([{ field: 'a', from: 1, to: 2 }]);
    expect(diff(null, { a: 1, b: '', c: null })).toEqual([{ field: 'a', from: null, to: 1 }]);
    expect(diff({ a: 1 }, { a: 1, extra: 'new' })).toEqual([{ field: 'extra', from: null, to: 'new' }]);
  });
});
