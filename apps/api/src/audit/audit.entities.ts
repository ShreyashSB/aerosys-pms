import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { Database } from '../db/db.module.js';
import {
  assignments,
  attendanceEntries,
  boqExecutions,
  boqItems,
  clients,
  dailyLogs,
  employees,
  engineerReviews,
  expenses,
  instrumentDeployments,
  instruments,
  projectBills,
  projectCosts,
  projectDocuments,
  projects,
  projectTypes,
  settings,
  sites,
  users,
} from '../db/schema.js';

/**
 * What the change history knows about one record at one moment: a readable
 * name, the project it belongs to, and its fields as people see them (ids
 * replaced by the names they point to, no passwords, no timestamps).
 *
 * The history compares the snapshot taken before a change with the one taken
 * after it, so each loader decides which fields are worth tracking.
 */
export interface Snapshot {
  label: string;
  projectId: string | null;
  values: Record<string, unknown>;
}

type Loader = (db: Database, id: string) => Promise<Snapshot | null>;

const employeeName = async (db: Database, id: string | null) => {
  if (!id) return null;
  const [e] = await db.select({ name: employees.name }).from(employees).where(eq(employees.id, id));
  return e?.name ?? null;
};

const nameOf = async (db: Database, table: typeof clients | typeof sites | typeof projectTypes, id: string) => {
  const [row] = await db.select({ name: table.name }).from(table).where(eq(table.id, id));
  return row?.name ?? null;
};

const projectCode = async (db: Database, id: string) => {
  const [p] = await db.select({ code: projects.code }).from(projects).where(eq(projects.id, id));
  return p?.code ?? null;
};

const STATUS: Record<string, string> = {
  on_site: 'On site',
  off_site: 'Off site',
  idle: 'Idle',
  weekly_off: 'Weekly off',
  holiday: 'Holiday',
  leave: 'Leave',
};

const short = (text: string, max = 60) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** One loader per kind of record the history follows. The key is stored in audit_log.entity. */
export const AUDIT_ENTITIES = {
  async employee(db, id) {
    const [e] = await db.select().from(employees).where(eq(employees.id, id));
    if (!e) return null;
    return {
      label: `${e.name} (${e.code})`,
      projectId: null,
      values: {
        code: e.code,
        name: e.name,
        email: e.email,
        phone: e.phone,
        department: e.department,
        designation: e.designation,
        dailyCost: e.dailyCost,
        joiningDate: e.joiningDate,
        status: e.status,
        isSiteEngineer: e.isSiteEngineer,
        baseLocation: e.baseLocation,
      },
    };
  },

  async login(db, id) {
    const [u] = await db.select().from(users).where(eq(users.id, id));
    if (!u) return null;
    return {
      label: (await employeeName(db, u.employeeId)) ?? 'Login',
      projectId: null,
      values: { role: u.role, active: u.active },
    };
  },

  async project(db, id) {
    const [p] = await db.select().from(projects).where(eq(projects.id, id));
    if (!p) return null;
    return {
      label: `${p.code} · ${p.name}`,
      projectId: p.id,
      values: {
        code: p.code,
        name: p.name,
        client: await nameOf(db, clients, p.clientId),
        site: await nameOf(db, sites, p.siteId),
        projectType: await nameOf(db, projectTypes, p.projectTypeId),
        manager: await employeeName(db, p.managerId),
        workOrderNo: p.workOrderNo,
        poNo: p.poNo,
        poDate: p.poDate,
        contractValue: p.contractValue,
        estimatedCost: p.estimatedCost,
        allottedManDays: p.allottedManDays,
        allottedExpenses: p.allottedExpenses,
        operationalCostPerManDay: p.operationalCostPerManDay,
        startDate: p.startDate,
        endDate: p.endDate,
        periodStart: p.periodStart,
        description: p.description,
        status: p.status,
      },
    };
  },

  async client(db, id) {
    const [c] = await db.select().from(clients).where(eq(clients.id, id));
    return c ? { label: c.name, projectId: null, values: { name: c.name } } : null;
  },

  async assignment(db, id) {
    const [a] = await db.select().from(assignments).where(eq(assignments.id, id));
    if (!a) return null;
    const name = await employeeName(db, a.employeeId);
    return {
      label: name ?? 'Assignment',
      projectId: a.projectId,
      values: { engineer: name, role: a.role, allocation: a.allocation, startDate: a.startDate, endDate: a.endDate },
    };
  },

  async boq_item(db, id) {
    const [b] = await db.select().from(boqItems).where(eq(boqItems.id, id));
    if (!b) return null;
    return {
      label: `${b.srNo} · ${short(b.description)}`,
      projectId: b.projectId,
      values: { srNo: b.srNo, description: b.description, uom: b.uom, contractQty: b.contractQty, rate: b.rate },
    };
  },

  async boq_execution(db, id) {
    const [x] = await db.select().from(boqExecutions).where(eq(boqExecutions.id, id));
    if (!x) return null;
    const [item] = await db.select().from(boqItems).where(eq(boqItems.id, x.boqItemId));
    const itemLabel = item ? `${item.srNo} · ${short(item.description, 40)}` : 'BOQ item';
    return {
      label: `${itemLabel} on ${x.date}`,
      projectId: x.projectId,
      values: { boqItem: itemLabel, date: x.date, qty: x.qty, remarks: x.remarks },
    };
  },

  /** A daily log with its attendance and work quantities, one field per person and per BOQ line. */
  async daily_log(db, id) {
    const [log] = await db.select().from(dailyLogs).where(eq(dailyLogs.id, id));
    if (!log) return null;
    const values: Record<string, unknown> = {
      date: log.date,
      activities: log.activities,
      remarks: log.remarks,
      createdBy: await employeeName(db, log.createdById),
    };
    const people = await db
      .select({ name: employees.name, status: attendanceEntries.status, idleHours: attendanceEntries.idleHours, idleReason: attendanceEntries.idleReason })
      .from(attendanceEntries)
      .innerJoin(employees, eq(employees.id, attendanceEntries.employeeId))
      .where(eq(attendanceEntries.dailyLogId, id))
      .orderBy(asc(employees.name));
    for (const p of people) {
      let text = STATUS[p.status] ?? p.status;
      if (p.idleHours > 0) text += `, ${p.idleHours} h idle`;
      if (p.idleReason) text += ` (${p.idleReason})`;
      values[`Attendance · ${p.name}`] = text;
    }
    const work = await db
      .select({ srNo: boqItems.srNo, description: boqItems.description, uom: boqItems.uom, qty: boqExecutions.qty })
      .from(boqExecutions)
      .innerJoin(boqItems, eq(boqItems.id, boqExecutions.boqItemId))
      .where(eq(boqExecutions.dailyLogId, id))
      .orderBy(asc(boqItems.srNo));
    for (const w of work) values[`Work · ${w.srNo} ${short(w.description, 40)}`] = `${w.qty} ${w.uom}`;
    return { label: `Daily log ${log.date}`, projectId: log.projectId, values };
  },

  async expense(db, id) {
    const [x] = await db.select().from(expenses).where(eq(expenses.id, id));
    if (!x) return null;
    return {
      label: `${x.code} · ${x.category}`,
      projectId: x.projectId,
      values: {
        employee: await employeeName(db, x.employeeId),
        category: x.category,
        amount: x.amount,
        date: x.date,
        description: x.description,
        receipt: x.receipt?.fileName ?? null,
      },
    };
  },

  async bill(db, id) {
    const [b] = await db.select().from(projectBills).where(eq(projectBills.id, id));
    if (!b) return null;
    return {
      label: `${b.kind === 'client_invoice' ? 'Invoice' : 'Vendor bill'} ${b.number}`,
      projectId: b.projectId,
      values: { kind: b.kind, number: b.number, party: b.party, amount: b.amount, date: b.date, notes: b.notes, attachment: b.attachment?.fileName ?? null },
    };
  },

  async project_cost(db, id) {
    const [c] = await db.select().from(projectCosts).where(eq(projectCosts.id, id));
    if (!c) return null;
    return {
      label: short(c.description),
      projectId: c.projectId,
      values: { type: c.type, description: c.description, amount: c.amount, date: c.date },
    };
  },

  /** An instrument, with where it is deployed right now. */
  async instrument(db, id) {
    const [i] = await db.select().from(instruments).where(eq(instruments.id, id));
    if (!i) return null;
    const [open] = await db
      .select()
      .from(instrumentDeployments)
      .where(and(eq(instrumentDeployments.instrumentId, id), isNull(instrumentDeployments.returnedAt)));
    return {
      label: `${i.code} · ${i.name}`,
      projectId: null,
      values: {
        code: i.code,
        name: i.name,
        serialNumber: i.serialNumber,
        category: i.category,
        assetValue: i.assetValue,
        purchaseDate: i.purchaseDate,
        endOfLifeDate: i.endOfLifeDate,
        currentLocation: i.currentLocation,
        calibrationCertificate: i.calibration?.fileName ?? null,
        calibrationValidUntil: i.calibration?.validUntil ?? null,
        status: i.status,
        notes: i.notes,
        deployedTo: open ? await projectCode(db, open.projectId) : null,
        withEngineer: open ? await employeeName(db, open.engineerId) : null,
      },
    };
  },

  async document(db, id) {
    const [d] = await db.select().from(projectDocuments).where(eq(projectDocuments.id, id));
    if (!d) return null;
    return { label: d.name, projectId: d.projectId, values: { name: d.name, type: d.type, size: d.size } };
  },

  /** All engineer ratings on one project; the id is the project's. */
  async reviews(db, projectId) {
    const rows = await db
      .select({ name: employees.name, rating: engineerReviews.rating, comments: engineerReviews.comments })
      .from(engineerReviews)
      .innerJoin(employees, eq(employees.id, engineerReviews.employeeId))
      .where(eq(engineerReviews.projectId, projectId))
      .orderBy(asc(employees.name));
    const values: Record<string, unknown> = {};
    for (const r of rows) values[`Rating · ${r.name}`] = r.comments ? `${r.rating}/5 · ${r.comments}` : `${r.rating}/5`;
    return { label: 'Engineer reviews', projectId, values };
  },

  async settings(db) {
    const [s] = await db.select().from(settings).where(eq(settings.id, 1));
    if (!s) return null;
    return {
      label: 'Company settings',
      projectId: null,
      values: {
        companyName: s.companyName,
        deadlineAlertDays: s.deadlineAlertDays,
        hoursPerManDay: s.hoursPerManDay,
        projectionMethod: s.projectionMethod,
        targetMarginPct: s.targetMarginPct,
      },
    };
  },
} satisfies Record<string, Loader>;

export type AuditEntity = keyof typeof AUDIT_ENTITIES;
export const AUDIT_ENTITY_NAMES = Object.keys(AUDIT_ENTITIES) as AuditEntity[];

/** `code · name` for each project id, for the history rows. */
export async function projectLabels(db: Database, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select({ id: projects.id, code: projects.code, name: projects.name }).from(projects).where(inArray(projects.id, ids));
  return new Map(rows.map((p) => [p.id, `${p.code} · ${p.name}`]));
}
