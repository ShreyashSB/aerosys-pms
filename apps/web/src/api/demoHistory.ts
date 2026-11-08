/**
 * The change history for the in-browser demo data. The live app records
 * history on the server (apps/api/src/audit); this mirrors it so the History
 * page works in the demo too.
 *
 * `db.write()` keeps a copy of the data from before a change and calls
 * `recordChanges()` after it. Each tracked record is compared by its JSON,
 * and only records that changed are turned into readable snapshots.
 * History is kept under its own storage key, so "Reset demo data" and new
 * demo seeds leave it alone.
 */
import type { AuditChange, AuditEntity, AuditEntry, Role } from "@/types/models";
import type { Database } from "./seed";
import { addDays } from "@/lib/dates";

const STORAGE_KEY = "aerosys.history.v1";
const SESSION_KEY = "aerosys.session.userId";
/** The demo keeps the newest entries only, so localStorage never fills up. */
const MAX_ENTRIES = 2000;

interface Snapshot {
  label: string;
  projectId: string | null;
  values: Record<string, unknown>;
}

type Tracked = { entity: AuditEntity; rows: (data: Database) => Array<{ id: string; sig: string }>; snap: (data: Database, id: string) => Snapshot | null };

const STATUS: Record<string, string> = { on_site: "On site", off_site: "Off site", idle: "Idle", weekly_off: "Weekly off", holiday: "Holiday", leave: "Leave" };
const short = (text: string, max = 60) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const empName = (data: Database, id: string | null) => (id ? (data.employees.find((e) => e.id === id)?.name ?? null) : null);
const projectCode = (data: Database, id: string | null) => (id ? (data.projects.find((p) => p.id === id)?.code ?? null) : null);
const byId = <T extends { id: string }>(rows: T[]) => rows.map((r) => ({ id: r.id, sig: JSON.stringify(r) }));

const TRACKED: Tracked[] = [
  {
    entity: "employee",
    rows: (d) => byId(d.employees),
    snap(d, id) {
      const e = d.employees.find((x) => x.id === id);
      if (!e) return null;
      const { id: _id, ...values } = e;
      return { label: `${e.name} (${e.code})`, projectId: null, values };
    },
  },
  {
    entity: "login",
    rows: (d) => d.users.map((u) => ({ id: u.id, sig: JSON.stringify([u.role, u.active ?? true]) })),
    snap(d, id) {
      const u = d.users.find((x) => x.id === id);
      return u ? { label: empName(d, u.employeeId) ?? "Login", projectId: null, values: { role: u.role, active: u.active ?? true } } : null;
    },
  },
  {
    entity: "project",
    rows: (d) => d.projects.map((p) => ({ id: p.id, sig: JSON.stringify({ ...p, updatedAt: null }) })),
    snap(d, id) {
      const p = d.projects.find((x) => x.id === id);
      if (!p) return null;
      return {
        label: `${p.code} · ${p.name}`,
        projectId: p.id,
        values: {
          code: p.code,
          name: p.name,
          client: p.clientName,
          site: p.site,
          projectType: p.projectType,
          manager: empName(d, p.managerId),
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
  },
  {
    entity: "assignment",
    rows: (d) => byId(d.assignments),
    snap(d, id) {
      const a = d.assignments.find((x) => x.id === id);
      if (!a) return null;
      const name = empName(d, a.employeeId);
      return { label: name ?? "Assignment", projectId: a.projectId, values: { engineer: name, role: a.role, allocation: a.allocation, startDate: a.startDate, endDate: a.endDate } };
    },
  },
  {
    entity: "boq_item",
    rows: (d) => byId(d.boqItems),
    snap(d, id) {
      const b = d.boqItems.find((x) => x.id === id);
      if (!b) return null;
      return { label: `${b.srNo} · ${short(b.description)}`, projectId: b.projectId, values: { srNo: b.srNo, description: b.description, uom: b.uom, contractQty: b.contractQty, rate: b.rate } };
    },
  },
  {
    // Quantities saved with a daily log show up in that log's history instead.
    entity: "boq_execution",
    rows: (d) => byId(d.boqExecutions.filter((x) => !x.dailyLogId)),
    snap(d, id) {
      const x = d.boqExecutions.find((r) => r.id === id);
      if (!x) return null;
      const item = d.boqItems.find((b) => b.id === x.boqItemId);
      const itemLabel = item ? `${item.srNo} · ${short(item.description, 40)}` : "BOQ item";
      return { label: `${itemLabel} on ${x.date}`, projectId: x.projectId, values: { boqItem: itemLabel, date: x.date, qty: x.qty, remarks: x.remarks } };
    },
  },
  {
    entity: "daily_log",
    rows(d) {
      const work = new Map<string, unknown[]>();
      for (const x of d.boqExecutions) if (x.dailyLogId) work.set(x.dailyLogId, [...(work.get(x.dailyLogId) ?? []), [x.boqItemId, x.qty]]);
      return d.dailyLogs.map((l) => ({ id: l.id, sig: JSON.stringify([l.date, l.activities, l.remarks, l.attendance, work.get(l.id) ?? []]) }));
    },
    snap(d, id) {
      const log = d.dailyLogs.find((l) => l.id === id);
      if (!log) return null;
      const values: Record<string, unknown> = { date: log.date, activities: log.activities, remarks: log.remarks, createdBy: empName(d, log.createdById) };
      const people = log.attendance.map((a) => ({ ...a, name: empName(d, a.employeeId) ?? "Unknown" })).sort((a, b) => a.name.localeCompare(b.name));
      for (const p of people) {
        let text = STATUS[p.status] ?? p.status;
        if (p.idleHours > 0) text += `, ${p.idleHours} h idle`;
        if (p.idleReason) text += ` (${p.idleReason})`;
        values[`Attendance · ${p.name}`] = text;
      }
      const work = d.boqExecutions
        .filter((x) => x.dailyLogId === id)
        .map((x) => ({ x, item: d.boqItems.find((b) => b.id === x.boqItemId) }))
        .sort((a, b) => (a.item?.srNo ?? "").localeCompare(b.item?.srNo ?? "", undefined, { numeric: true }));
      for (const { x, item } of work) values[`Work · ${item?.srNo ?? ""} ${short(item?.description ?? "", 40)}`] = `${x.qty} ${item?.uom ?? ""}`.trim();
      return { label: `Daily log ${log.date}`, projectId: log.projectId, values };
    },
  },
  {
    entity: "expense",
    rows: (d) => byId(d.expenses),
    snap(d, id) {
      const x = d.expenses.find((e) => e.id === id);
      if (!x) return null;
      return {
        label: `${x.code} · ${x.category}`,
        projectId: x.projectId,
        values: { employee: empName(d, x.employeeId), category: x.category, amount: x.amount, date: x.date, description: x.description, receipt: x.receipt?.fileName ?? null },
      };
    },
  },
  {
    entity: "bill",
    rows: (d) => byId(d.bills),
    snap(d, id) {
      const b = d.bills.find((x) => x.id === id);
      if (!b) return null;
      return {
        label: `${b.kind === "client_invoice" ? "Invoice" : "Vendor bill"} ${b.number}`,
        projectId: b.projectId,
        values: { kind: b.kind, number: b.number, party: b.party, amount: b.amount, date: b.date, notes: b.notes, attachment: b.attachment?.fileName ?? null },
      };
    },
  },
  {
    entity: "project_cost",
    rows: (d) => byId(d.projectCosts),
    snap(d, id) {
      const c = d.projectCosts.find((x) => x.id === id);
      return c ? { label: short(c.description), projectId: c.projectId, values: { type: c.type, description: c.description, amount: c.amount, date: c.date } } : null;
    },
  },
  {
    entity: "instrument",
    rows: (d) => byId(d.instruments),
    snap(d, id) {
      const i = d.instruments.find((x) => x.id === id);
      if (!i) return null;
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
          status: i.status === "assigned" ? "available" : i.status,
          notes: i.notes,
          deployedTo: projectCode(d, i.assignedProjectId),
          withEngineer: empName(d, i.assignedEngineerId),
        },
      };
    },
  },
  {
    entity: "document",
    rows: (d) => byId(d.documents),
    snap(d, id) {
      const doc = d.documents.find((x) => x.id === id);
      return doc ? { label: doc.name, projectId: doc.projectId, values: { name: doc.name, type: doc.type, size: doc.size } } : null;
    },
  },
  {
    // All ratings on one project form one record, keyed by the project id.
    entity: "reviews",
    rows(d) {
      const byProject = new Map<string, unknown[]>();
      for (const r of d.engineerReviews) byProject.set(r.projectId, [...(byProject.get(r.projectId) ?? []), [r.employeeId, r.rating, r.comments]]);
      return [...byProject].map(([id, rows]) => ({ id, sig: JSON.stringify(rows) }));
    },
    snap(d, projectId) {
      const rows = d.engineerReviews
        .filter((r) => r.projectId === projectId)
        .map((r) => ({ ...r, name: empName(d, r.employeeId) ?? "Unknown" }))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (rows.length === 0) return null;
      const values: Record<string, unknown> = {};
      for (const r of rows) values[`Rating · ${r.name}`] = r.comments ? `${r.rating}/5 · ${r.comments}` : `${r.rating}/5`;
      return { label: "Engineer reviews", projectId, values };
    },
  },
  {
    entity: "settings",
    rows: (d) => [{ id: "1", sig: JSON.stringify(d.settings) }],
    snap(d) {
      const s = d.settings;
      return {
        label: "Company settings",
        projectId: null,
        values: { companyName: s.companyName, deadlineAlertDays: s.deadlineAlertDays, hoursPerManDay: s.hoursPerManDay, projectionMethod: s.projectionMethod, targetMarginPct: s.targetMarginPct },
      };
    },
  },
];

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const blank = (v: unknown) => v === null || v === undefined || v === "";

/** Same rules as the server's diff(): changed fields only, blanks left out of adds and removals. */
export function diff(before: Record<string, unknown> | null, after: Record<string, unknown> | null): AuditChange[] {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  const out: AuditChange[] = [];
  for (const field of keys) {
    const from = before?.[field] ?? null;
    const to = after?.[field] ?? null;
    if (same(from, to)) continue;
    if ((!before || !after) && blank(from) && blank(to)) continue;
    out.push({ field, from, to });
  }
  return out;
}

/** Compares the data now with a copy from before the change and saves one entry per changed record. */
export function recordChanges(old: Database, data: Database) {
  const entries: AuditEntry[] = [];
  const actor = currentActor(data);
  const at = new Date().toISOString();
  for (const t of TRACKED) {
    const prev = new Map(t.rows(old).map((r) => [r.id, r.sig]));
    const now = new Map(t.rows(data).map((r) => [r.id, r.sig]));
    const ids = [...now.keys()].filter((id) => prev.get(id) !== now.get(id));
    ids.push(...[...prev.keys()].filter((id) => !now.has(id)));
    for (const id of ids) {
      const b = prev.has(id) ? t.snap(old, id) : null;
      const a = now.has(id) ? t.snap(data, id) : null;
      const current = a ?? b;
      if (!current) continue;
      const changes = diff(b?.values ?? null, a?.values ?? null);
      if (changes.length === 0 && b && a) continue;
      const project = current.projectId ? (data.projects.find((p) => p.id === current.projectId) ?? old.projects.find((p) => p.id === current.projectId)) : undefined;
      entries.push({
        id: `aud-${Math.random().toString(36).slice(2, 10)}`,
        at,
        ...actor,
        entity: t.entity,
        entityId: id,
        entityLabel: current.label,
        projectId: current.projectId,
        projectLabel: t.entity === "project" ? current.label : project ? `${project.code} · ${project.name}` : null,
        action: !b ? "create" : !a ? "delete" : "update",
        summary: null,
        changes,
      });
    }
  }
  if (entries.length) saveEntries([...entries, ...loadEntries(old)]);
}

function currentActor(data: Database): Pick<AuditEntry, "actorEmployeeId" | "actorName" | "actorRole"> {
  let userId: string | null = null;
  try {
    userId = localStorage.getItem(SESSION_KEY);
  } catch {
    // no storage: unknown actor
  }
  const user = data.users.find((u) => u.id === userId);
  const emp = user ? data.employees.find((e) => e.id === user.employeeId) : undefined;
  return { actorEmployeeId: emp?.id ?? null, actorName: emp?.name ?? "Unknown", actorRole: (user?.role ?? "management") satisfies Role };
}

let cache: AuditEntry[] | null = null;

/** Newest first. A first visit starts with a few example entries made from the demo data. */
export function loadEntries(data?: Database): AuditEntry[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) cache = JSON.parse(raw) as AuditEntry[];
  } catch {
    // corrupted storage: start again
  }
  if (!cache) saveEntries(data ? exampleEntries(data) : []);
  return cache ?? [];
}

/** What a few weeks of normal use would leave behind: rate, contract, daily log and settings changes. */
function exampleEntries(d: Database): AuditEntry[] {
  const management = d.users.find((u) => u.role === "management");
  const accounts = d.users.find((u) => u.role === "accounts");
  const pm = d.users.find((u) => u.role === "project_manager");
  const who = (u: typeof management) => {
    const e = u && d.employees.find((x) => x.id === u.employeeId);
    return { actorEmployeeId: e?.id ?? null, actorName: e?.name ?? "Unknown", actorRole: u?.role ?? "management" };
  };
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  const out: AuditEntry[] = [];
  const add = (e: Omit<AuditEntry, "id">) => out.push({ id: `aud-example-${out.length + 1}`, ...e });

  const engineer = d.employees.find((e) => e.isSiteEngineer);
  if (engineer)
    add({
      at: hoursAgo(3), ...who(accounts), entity: "employee", entityId: engineer.id, entityLabel: `${engineer.name} (${engineer.code})`,
      projectId: null, projectLabel: null, action: "update", summary: null,
      changes: [{ field: "dailyCost", from: Math.max(0, engineer.dailyCost - 300), to: engineer.dailyCost }],
    });
  const log = d.dailyLogs.find((l) => l.attendance.length > 1 && pm && d.projects.find((p) => p.id === l.projectId)?.managerId === pm.employeeId) ?? d.dailyLogs[0];
  const logProject = log && d.projects.find((p) => p.id === log.projectId);
  const person = log && empName(d, log.attendance[0]?.employeeId ?? null);
  if (log && logProject && person)
    add({
      at: hoursAgo(20), ...who(pm), entity: "daily_log", entityId: log.id, entityLabel: `Daily log ${log.date}`,
      projectId: logProject.id, projectLabel: `${logProject.code} · ${logProject.name}`, action: "update", summary: null,
      changes: [
        { field: `Attendance · ${person}`, from: "Off site", to: STATUS[log.attendance[0].status] ?? log.attendance[0].status },
        { field: "remarks", from: "", to: log.remarks || "Corrected attendance after site call" },
      ],
    });
  const project = d.projects.find((p) => p.status === "active") ?? d.projects[0];
  if (project)
    add({
      at: hoursAgo(50), ...who(management), entity: "project", entityId: project.id, entityLabel: `${project.code} · ${project.name}`,
      projectId: project.id, projectLabel: `${project.code} · ${project.name}`, action: "update", summary: null,
      changes: [
        { field: "contractValue", from: Math.round(project.contractValue * 0.92), to: project.contractValue },
        { field: "endDate", from: addDays(project.endDate, -30), to: project.endDate },
      ],
    });
  const expense = d.expenses.find((e) => e.projectId === project?.id) ?? d.expenses[0];
  const expenseProject = expense && d.projects.find((p) => p.id === expense.projectId);
  if (expense && expenseProject)
    add({
      at: hoursAgo(75), ...who(accounts), entity: "expense", entityId: expense.id, entityLabel: `${expense.code} · ${expense.category}`,
      projectId: expenseProject.id, projectLabel: `${expenseProject.code} · ${expenseProject.name}`, action: "create", summary: null,
      changes: diff(null, { employee: empName(d, expense.employeeId), category: expense.category, amount: expense.amount, date: expense.date, description: expense.description }),
    });
  add({
    at: hoursAgo(120), ...who(management), entity: "settings", entityId: "1", entityLabel: "Company settings",
    projectId: null, projectLabel: null, action: "update", summary: null,
    changes: [{ field: "targetMarginPct", from: 18, to: d.settings.targetMarginPct }],
  });
  return out;
}

function saveEntries(entries: AuditEntry[]) {
  cache = entries.slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.warn("Could not save the demo change history", err);
  }
}
