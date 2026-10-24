import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { buildSeed } from '@/api/seed';
import { hashPassword } from '../src/auth/password.js';
import type { Database } from '../src/db/db.module.js';
import * as s from '../src/db/schema.js';

/**
 * Loads the web app's demo data (apps/web/src/api/seed.ts) into Postgres.
 * One generator feeds both, so the demo looks the same with or without the API.
 *
 * The demo uses ids like "prj_3"; the database uses uuids. `id()` gives each
 * demo id one uuid and hands back the same one every time it is asked again.
 *
 * Everything runs in one transaction: the database ends up fully seeded or
 * exactly as it was.
 */
/** Every demo login uses this password. Change it (or don't seed) anywhere real people sign in. */
export const DEMO_PASSWORD = 'demo1234';

export async function seedDemo(db: Database) {
  const demo = buildSeed();
  const ids = new Map<string, string>();
  const id = (demoId: string) => {
    let u = ids.get(demoId);
    if (!u) ids.set(demoId, (u = randomUUID()));
    return u;
  };
  const optId = (demoId: string | null) => (demoId ? id(demoId) : null);

  await db.transaction(async (tx) => {
    // Clear the data tables. CASCADE follows foreign keys (notification_reads goes with notifications); project types stay.
    await tx.execute(sql`TRUNCATE clients, sites, employees, projects, instruments, settings, notifications CASCADE`);

    /** Insert in chunks: Postgres takes at most 65,535 parameters in one statement. */
    const insert = async <T extends PgTable>(table: T, rows: T['$inferInsert'][]) => {
      for (let i = 0; i < rows.length; i += 500) await tx.insert(table).values(rows.slice(i, i + 500));
    };

    // ---- lookups: names → ids
    const clientIds = new Map<string, string>();
    const siteIds = new Map<string, string>();
    for (const name of demo.lookups.clients) clientIds.set(name, randomUUID());
    for (const name of demo.lookups.sites) siteIds.set(name, randomUUID());
    await insert(s.clients, [...clientIds].map(([name, cid]) => ({ id: cid, name })));
    await insert(s.sites, [...siteIds].map(([name, sid]) => ({ id: sid, name })));
    await tx
      .insert(s.projectTypes)
      .values(demo.lookups.projectTypes.map((name) => ({ name })))
      .onConflictDoNothing();
    const typeIds = new Map((await tx.select().from(s.projectTypes)).map((t) => [t.name, t.id]));

    await insert(s.settings, [{ id: 1, ...demo.settings }]);

    await insert(
      s.employees,
      demo.employees.map((e) => ({ ...e, id: id(e.id) })),
    );

    // Logins: the demo's users, all with DEMO_PASSWORD. Hashing is slow on purpose, so do it before the inserts.
    const loginRows = await Promise.all(
      demo.users.map(async (u) => ({ employeeId: id(u.employeeId), role: u.role, passwordHash: await hashPassword(DEMO_PASSWORD), mustChangePassword: false })),
    );
    await insert(s.users, loginRows);

    await insert(
      s.projects,
      demo.projects.map((p) => ({
        id: id(p.id),
        code: p.code,
        name: p.name,
        clientId: clientIds.get(p.clientName)!,
        siteId: siteIds.get(p.site)!,
        projectTypeId: typeIds.get(p.projectType)!,
        managerId: id(p.managerId),
        workOrderNo: p.workOrderNo,
        poNo: p.poNo,
        contractValue: p.contractValue,
        estimatedCost: p.estimatedCost,
        allottedManDays: p.allottedManDays,
        allottedExpenses: p.allottedExpenses,
        operationalCostPerDay: p.operationalCostPerDay,
        startDate: p.startDate,
        endDate: p.endDate,
        periodStart: p.periodStart,
        description: p.description,
        status: p.status,
        createdAt: new Date(p.createdAt),
      })),
    );

    await insert(
      s.assignments,
      demo.assignments.map((a) => ({ ...a, id: id(a.id), projectId: id(a.projectId), employeeId: id(a.employeeId) })),
    );

    await insert(
      s.boqItems,
      demo.boqItems.map((b) => ({ ...b, id: id(b.id), projectId: id(b.projectId) })),
    );

    await insert(
      s.dailyLogs,
      demo.dailyLogs.map((l) => ({
        id: id(l.id),
        projectId: id(l.projectId),
        date: l.date,
        activities: l.activities,
        remarks: l.remarks,
        createdById: id(l.createdById),
        createdAt: new Date(l.createdAt),
      })),
    );
    await insert(
      s.attendanceEntries,
      demo.dailyLogs.flatMap((l) => l.attendance.map((a) => ({ ...a, dailyLogId: id(l.id), employeeId: id(a.employeeId) }))),
    );

    await insert(
      s.boqExecutions,
      demo.boqExecutions.map((x) => ({
        ...x,
        id: id(x.id),
        projectId: id(x.projectId),
        boqItemId: id(x.boqItemId),
        dailyLogId: optId(x.dailyLogId),
      })),
    );

    await insert(
      s.expenses,
      demo.expenses.map((e) => ({
        ...e,
        id: id(e.id),
        projectId: id(e.projectId),
        employeeId: id(e.employeeId),
        reviewedById: optId(e.reviewedById),
        submittedAt: new Date(e.submittedAt),
        reviewedAt: e.reviewedAt ? new Date(e.reviewedAt) : null,
      })),
    );
    // The demo brings its own EXP numbers, so move the sequence past them.
    await tx.execute(
      sql`SELECT setval('expense_code_seq', GREATEST(1001, (SELECT COALESCE(MAX(substring(code from 5)::int), 0) + 1 FROM expenses)), false)`,
    );

    await insert(
      s.projectBills,
      demo.bills.map((b) => ({ ...b, id: id(b.id), projectId: id(b.projectId), createdById: id(b.createdById), createdAt: new Date(b.createdAt) })),
    );

    await insert(
      s.projectCosts,
      demo.projectCosts.map((c) => ({ ...c, id: id(c.id), projectId: id(c.projectId) })),
    );

    await insert(
      s.instruments,
      demo.instruments.map((i) => ({
        id: id(i.id),
        code: i.code,
        name: i.name,
        serialNumber: i.serialNumber,
        category: i.category,
        assetValue: i.assetValue,
        purchaseDate: i.purchaseDate,
        endOfLifeDate: i.endOfLifeDate,
        currentLocation: i.currentLocation,
        calibration: i.calibration,
        // "assigned" is worked out from the open deployment, so it isn't stored.
        status: i.status === 'assigned' ? 'available' : i.status,
        notes: i.notes,
      })),
    );
    await insert(
      s.instrumentDeployments,
      demo.projectInstruments.map((d) => ({
        id: id(d.id),
        instrumentId: id(d.instrumentId),
        projectId: id(d.projectId),
        engineerId: optId(d.engineerId),
        assignedAt: d.assignedAt,
        returnedAt: d.returnedAt,
      })),
    );

    await insert(
      s.projectDocuments,
      demo.documents.map((d) => ({ ...d, id: id(d.id), projectId: id(d.projectId), uploadedById: id(d.uploadedById), uploadedAt: new Date(d.uploadedAt) })),
    );

    await insert(
      s.engineerReviews,
      demo.engineerReviews.map((r) => ({
        ...r,
        id: id(r.id),
        projectId: id(r.projectId),
        employeeId: id(r.employeeId),
        reviewerId: id(r.reviewerId),
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      })),
    );

    // Audience employee ids are an array, not a foreign key, so they are mapped by hand.
    await insert(
      s.notifications,
      demo.notifications.map((n) => ({
        type: n.type,
        title: n.title,
        message: n.message,
        link: n.link,
        audienceRoles: n.audienceRoles,
        audienceEmployeeIds: n.audienceEmployeeIds.map(id),
        dedupeKey: n.dedupeKey ?? null,
        createdAt: new Date(n.createdAt),
      })),
    );
  });

  return {
    employees: demo.employees.length,
    users: demo.users.length,
    projects: demo.projects.length,
    dailyLogs: demo.dailyLogs.length,
    expenses: demo.expenses.length,
    instruments: demo.instruments.length,
    notifications: demo.notifications.length,
  };
}
