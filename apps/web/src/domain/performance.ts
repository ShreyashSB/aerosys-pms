/**
 * Project performance engine — pure functions, no I/O.
 *
 *   WORK ORDER → BOQ → EXECUTED QTY → EXECUTED VALUE → PROGRESS → EARNED VALUE
 *   DAILY LOGS → MAN-DAYS (consumed / idle) → WAGES → RUNNING PPI
 *   WAGES + EXPENSES + OVERHEAD + INSTRUMENTS + MANAGEMENT (+ OTHER) → COST TO DATE
 *   COST TO DATE + PROGRESS → PROJECTED FINAL COST → PROJECTED PROFIT
 *
 * All business formulas come from `assumptions.ts`.
 */
import { addDays, daysBetween, minDate, todayISO } from "@/lib/dates";
import type {
  AppSettings,
  BoqExecution,
  BoqItem,
  DailyLog,
  Employee,
  Expense,
  IdleReason,
  Instrument,
  Project,
  ProjectCost,
  ProjectInstrument,
  ProjectionMethod,
} from "@/types/models";
import {
  MAN_DAY_WEIGHT,
  earnedValue as calcEarnedValue,
  expectedProgress as calcExpectedProgress,
  idleManDays,
  instrumentCharge,
  managementCost,
  overheadCost,
  ppi as calcPpi,
  progressFromBoq,
  projectFinalCost,
  runningPpi as calcRunningPpi,
} from "./assumptions";

export interface PerformanceData {
  employees: Employee[];
  expenses: Expense[];
  instruments: Instrument[];
  projectInstruments: ProjectInstrument[];
  projectCosts: ProjectCost[];
  boqItems: BoqItem[];
  boqExecutions: BoqExecution[];
  dailyLogs: DailyLog[];
}

interface ProjectBucket {
  boqItems: BoqItem[];
  executions: BoqExecution[];
  logs: DailyLog[];
  expenses: Expense[];
  deployments: ProjectInstrument[];
  otherCosts: ProjectCost[];
}

export interface PerformanceIndex {
  buckets: Map<string, ProjectBucket>;
  dailyCost: Map<string, number>;
  instrumentValue: Map<string, number>;
}

function bucket(idx: Map<string, ProjectBucket>, id: string) {
  let b = idx.get(id);
  if (!b) {
    b = { boqItems: [], executions: [], logs: [], expenses: [], deployments: [], otherCosts: [] };
    idx.set(id, b);
  }
  return b;
}

/** Group every record by project once, so per-project computation is cheap. */
export function buildIndex(d: PerformanceData): PerformanceIndex {
  const buckets = new Map<string, ProjectBucket>();
  for (const x of d.boqItems) bucket(buckets, x.projectId).boqItems.push(x);
  for (const x of d.boqExecutions) bucket(buckets, x.projectId).executions.push(x);
  for (const x of d.dailyLogs) bucket(buckets, x.projectId).logs.push(x);
  for (const x of d.expenses) bucket(buckets, x.projectId).expenses.push(x);
  for (const x of d.projectInstruments) bucket(buckets, x.projectId).deployments.push(x);
  for (const x of d.projectCosts) bucket(buckets, x.projectId).otherCosts.push(x);
  return {
    buckets,
    dailyCost: new Map(d.employees.map((e) => [e.id, e.dailyCost])),
    instrumentValue: new Map(d.instruments.map((i) => [i.id, i.purchaseValue])),
  };
}

// ---------------------------------------------------------------- BOQ

export interface BoqRow {
  item: BoqItem;
  contractAmount: number;
  previousQty: number;
  currentQty: number;
  executedQty: number;
  balanceQty: number;
  previousAmount: number;
  currentAmount: number;
  executedAmount: number;
  balanceAmount: number;
  pct: number; // 0-1
}

export function boqRows(items: BoqItem[], executions: BoqExecution[], periodStart: string, asOf = todayISO()): BoqRow[] {
  const prev = new Map<string, number>();
  const curr = new Map<string, number>();
  for (const e of executions) {
    if (e.date > asOf) continue;
    const m = e.date < periodStart ? prev : curr;
    m.set(e.boqItemId, (m.get(e.boqItemId) ?? 0) + e.qty);
  }
  return [...items]
    .sort((a, b) => a.srNo.localeCompare(b.srNo, undefined, { numeric: true }))
    .map((item) => {
      const previousQty = prev.get(item.id) ?? 0;
      const currentQty = curr.get(item.id) ?? 0;
      const executedQty = previousQty + currentQty;
      const contractAmount = item.contractQty * item.rate;
      return {
        item,
        contractAmount,
        previousQty,
        currentQty,
        executedQty,
        balanceQty: item.contractQty - executedQty,
        previousAmount: previousQty * item.rate,
        currentAmount: currentQty * item.rate,
        executedAmount: executedQty * item.rate,
        balanceAmount: (item.contractQty - executedQty) * item.rate,
        pct: item.contractQty > 0 ? executedQty / item.contractQty : 0,
      };
    });
}

// ---------------------------------------------------------------- performance

export interface CostHeads {
  wages: number;
  expenses: number;
  overhead: number;
  instruments: number;
  management: number;
  other: number;
  total: number;
}

export interface EmployeeProjectUsage {
  employeeId: string;
  manDays: number;
  idleManDays: number;
  wages: number;
  days: number;
}

export interface ProjectPerformance {
  projectId: string;
  asOf: string;
  contractValue: number;
  // BOQ & progress
  boqValue: number;
  executedValue: number;
  currentPeriodValue: number;
  boqItemCount: number;
  progress: number; // 0-1
  expectedProgress: number; // 0-1
  earnedValue: number;
  // man-days
  allottedManDays: number;
  consumedManDays: number;
  workingManDays: number;
  idleManDays: number;
  idleHours: number;
  plannedManDaysToDate: number;
  manDayUtilisation: number; // consumed / allotted, 0-1+
  idleByReason: Partial<Record<IdleReason, number>>;
  byEmployee: EmployeeProjectUsage[];
  logCount: number;
  lastLogDate: string | null;
  // PPI
  ppi: number;
  runningPpi: number;
  ppiVariance: number;
  ppiVariancePct: number;
  // expenses
  allottedExpenses: number;
  consumedExpenses: number;
  pendingExpenses: number;
  plannedExpensesToDate: number;
  expenseUtilisation: number; // 0-1+
  // cost
  costs: CostHeads;
  budget: number;
  budgetUtilisation: number; // 0-1+
  contribution: number; // earned value − cost to date
  // projection (ESTIMATES)
  projectionMethod: ProjectionMethod | "actual";
  remainingCost: number;
  finalCost: number;
  finalProfit: number;
  finalMarginPct: number;
  // schedule
  elapsedDays: number;
  totalDays: number;
}

export function computeProjectPerformance(
  project: Project,
  idx: PerformanceIndex,
  settings: AppSettings,
  asOf: string = todayISO(),
): ProjectPerformance {
  const b = idx.buckets.get(project.id) ?? { boqItems: [], executions: [], logs: [], expenses: [], deployments: [], otherCosts: [] };

  // BOQ → progress → earned value
  const rows = boqRows(b.boqItems, b.executions, project.periodStart, asOf);
  const boqValue = rows.reduce((s, r) => s + r.contractAmount, 0);
  const executedValue = rows.reduce((s, r) => s + r.executedAmount, 0);
  const currentPeriodValue = rows.reduce((s, r) => s + r.currentAmount, 0);
  const progress = progressFromBoq(executedValue, boqValue);
  const earned = calcEarnedValue(project.contractValue, progress);

  // Daily logs → man-days, idle, wages
  let consumed = 0;
  let idle = 0;
  let idleHours = 0;
  let wages = 0;
  let logCount = 0;
  let lastLogDate: string | null = null;
  const idleByReason: Partial<Record<IdleReason, number>> = {};
  const perEmp = new Map<string, EmployeeProjectUsage>();
  for (const log of b.logs) {
    if (log.date > asOf) continue;
    logCount++;
    if (!lastLogDate || log.date > lastLogDate) lastLogDate = log.date;
    for (const a of log.attendance) {
      const md = MAN_DAY_WEIGHT[a.status];
      const imd = idleManDays(a.status, a.idleHours, settings.hoursPerManDay);
      const w = md * (idx.dailyCost.get(a.employeeId) ?? 0);
      consumed += md;
      idle += imd;
      if (a.status !== "idle") idleHours += a.idleHours || 0;
      wages += w;
      if (imd > 0) {
        const r = a.idleReason ?? "Other";
        idleByReason[r] = (idleByReason[r] ?? 0) + imd;
      }
      let u = perEmp.get(a.employeeId);
      if (!u) {
        u = { employeeId: a.employeeId, manDays: 0, idleManDays: 0, wages: 0, days: 0 };
        perEmp.set(a.employeeId, u);
      }
      u.manDays += md;
      u.idleManDays += imd;
      u.wages += w;
      if (md > 0) u.days++;
    }
  }

  // Expenses (approved only count as consumed)
  let consumedExpenses = 0;
  let pendingExpenses = 0;
  for (const e of b.expenses) {
    if (e.date > asOf) continue;
    if (e.status === "approved") consumedExpenses += e.amount;
    else if (e.status === "pending") pendingExpenses += e.amount;
  }

  // Instruments
  let instruments = 0;
  for (const d of b.deployments) {
    const end = minDate(d.returnedAt ?? asOf, asOf);
    if (end < d.assignedAt) continue;
    instruments += instrumentCharge(idx.instrumentValue.get(d.instrumentId) ?? 0, daysBetween(d.assignedAt, end) + 1, settings);
  }

  const other = b.otherCosts.filter((c) => c.date <= asOf).reduce((s, c) => s + c.amount, 0);
  const overhead = overheadCost(wages, settings);
  const management = managementCost(earned, settings);
  const total = wages + consumedExpenses + overhead + instruments + management + other;

  // Schedule & plan
  const totalDays = Math.max(1, daysBetween(project.startDate, project.endDate));
  const elapsedDays = Math.max(0, daysBetween(project.startDate, asOf));
  const completed = project.status === "completed";
  const expected = completed ? 1 : calcExpectedProgress(elapsedDays, totalDays);

  const basePpi = calcPpi(project.contractValue, project.allottedManDays);
  const rPpi = calcRunningPpi(earned, consumed);

  const { finalCost, methodUsed } = projectFinalCost({
    costToDate: total,
    progress,
    budget: project.estimatedCost,
    completed,
    method: settings.projectionMethod,
  });
  const finalProfit = project.contractValue - finalCost;

  return {
    projectId: project.id,
    asOf,
    contractValue: project.contractValue,
    boqValue,
    executedValue,
    currentPeriodValue,
    boqItemCount: rows.length,
    progress,
    expectedProgress: expected,
    earnedValue: earned,
    allottedManDays: project.allottedManDays,
    consumedManDays: consumed,
    workingManDays: consumed - idle,
    idleManDays: idle,
    idleHours,
    plannedManDaysToDate: project.allottedManDays * expected,
    manDayUtilisation: project.allottedManDays > 0 ? consumed / project.allottedManDays : 0,
    idleByReason,
    byEmployee: [...perEmp.values()].sort((x, y) => y.manDays - x.manDays),
    logCount,
    lastLogDate,
    ppi: basePpi,
    runningPpi: rPpi,
    ppiVariance: consumed > 0 ? rPpi - basePpi : 0,
    ppiVariancePct: consumed > 0 && basePpi > 0 ? ((rPpi - basePpi) / basePpi) * 100 : 0,
    allottedExpenses: project.allottedExpenses,
    consumedExpenses,
    pendingExpenses,
    plannedExpensesToDate: project.allottedExpenses * expected,
    expenseUtilisation: project.allottedExpenses > 0 ? consumedExpenses / project.allottedExpenses : 0,
    costs: { wages, expenses: consumedExpenses, overhead, instruments, management, other, total },
    budget: project.estimatedCost,
    budgetUtilisation: project.estimatedCost > 0 ? total / project.estimatedCost : 0,
    contribution: earned - total,
    projectionMethod: methodUsed,
    remainingCost: finalCost - total,
    finalCost,
    finalProfit,
    finalMarginPct: project.contractValue > 0 ? (finalProfit / project.contractValue) * 100 : 0,
    elapsedDays,
    totalDays,
  };
}

/** Weekly cumulative series for trend charts (earned value vs cost, MD plan vs actual). */
export function performanceSeries(project: Project, idx: PerformanceIndex, settings: AppSettings, points = 16) {
  const today = todayISO();
  const end = minDate(project.status === "completed" ? project.endDate : today, today);
  const span = daysBetween(project.startDate, end);
  if (span <= 0) return [];
  const out: Array<{ date: string; earnedValue: number; cost: number; consumedMd: number; plannedMd: number; progress: number; expected: number }> = [];
  for (let i = 1; i <= points; i++) {
    const asOf = addDays(project.startDate, Math.round((span * i) / points));
    const p = computeProjectPerformance(project, idx, settings, asOf);
    out.push({
      date: asOf,
      earnedValue: Math.round(p.earnedValue),
      cost: Math.round(p.costs.total),
      consumedMd: Math.round(p.consumedManDays),
      plannedMd: Math.round(p.plannedManDaysToDate),
      progress: Math.round(p.progress * 1000) / 10,
      expected: Math.round(p.expectedProgress * 1000) / 10,
    });
  }
  return out;
}

// ---------------------------------------------------------------- portfolio

export interface PortfolioPerformance {
  projectCount: number;
  activeCount: number;
  completedCount: number;
  contractValue: number;
  earnedValue: number;
  costToDate: number;
  finalCost: number;
  finalProfit: number;
  finalMarginPct: number;
  allottedManDays: number;
  consumedManDays: number;
  idleManDays: number;
  ppi: number;
  runningPpi: number;
  allottedExpenses: number;
  consumedExpenses: number;
  expenseUtilisation: number;
  progress: number; // value-weighted
  costs: CostHeads;
}

export function summarisePortfolio(projects: Project[], perf: Map<string, ProjectPerformance>): PortfolioPerformance {
  const live = projects.filter((p) => p.status !== "archived");
  const acc = {
    contractValue: 0, earnedValue: 0, costToDate: 0, finalCost: 0, allottedManDays: 0, consumedManDays: 0,
    idleManDays: 0, allottedExpenses: 0, consumedExpenses: 0,
    // PPI is only meaningful where man-days have been consumed
    ppiContract: 0, ppiAllotted: 0, ppiEarned: 0, ppiConsumed: 0,
  };
  const costs: CostHeads = { wages: 0, expenses: 0, overhead: 0, instruments: 0, management: 0, other: 0, total: 0 };
  for (const p of live) {
    const f = perf.get(p.id);
    if (!f) continue;
    acc.contractValue += p.contractValue;
    acc.earnedValue += f.earnedValue;
    acc.costToDate += f.costs.total;
    acc.finalCost += f.finalCost;
    acc.allottedManDays += f.allottedManDays;
    acc.consumedManDays += f.consumedManDays;
    acc.idleManDays += f.idleManDays;
    acc.allottedExpenses += f.allottedExpenses;
    acc.consumedExpenses += f.consumedExpenses;
    if (f.consumedManDays > 0) {
      acc.ppiContract += p.contractValue;
      acc.ppiAllotted += f.allottedManDays;
      acc.ppiEarned += f.earnedValue;
      acc.ppiConsumed += f.consumedManDays;
    }
    for (const k of Object.keys(costs) as Array<keyof CostHeads>) costs[k] += f.costs[k];
  }
  const finalProfit = acc.contractValue - acc.finalCost;
  return {
    projectCount: live.length,
    activeCount: live.filter((p) => p.status === "active").length,
    completedCount: live.filter((p) => p.status === "completed").length,
    contractValue: acc.contractValue,
    earnedValue: acc.earnedValue,
    costToDate: acc.costToDate,
    finalCost: acc.finalCost,
    finalProfit,
    finalMarginPct: acc.contractValue ? (finalProfit / acc.contractValue) * 100 : 0,
    allottedManDays: acc.allottedManDays,
    consumedManDays: acc.consumedManDays,
    idleManDays: acc.idleManDays,
    ppi: calcPpi(acc.ppiContract, acc.ppiAllotted),
    runningPpi: calcRunningPpi(acc.ppiEarned, acc.ppiConsumed),
    allottedExpenses: acc.allottedExpenses,
    consumedExpenses: acc.consumedExpenses,
    expenseUtilisation: acc.allottedExpenses ? acc.consumedExpenses / acc.allottedExpenses : 0,
    progress: acc.contractValue ? acc.earnedValue / acc.contractValue : 0,
    costs,
  };
}

// ---------------------------------------------------------------- per-log

export interface LogSummary {
  people: number; // persons consuming man-days
  manDays: number;
  workingManDays: number;
  idleManDays: number;
  idleHours: number;
  wages: number;
}

/** Same rules as the project engine, applied to one daily log. */
export function summariseLog(
  attendance: Array<{ employeeId: string; status: keyof typeof MAN_DAY_WEIGHT; idleHours: number }>,
  hoursPerManDay: number,
  dailyCost: (employeeId: string) => number,
): LogSummary {
  let people = 0;
  let manDays = 0;
  let idle = 0;
  let idleHours = 0;
  let wages = 0;
  for (const a of attendance) {
    const md = MAN_DAY_WEIGHT[a.status];
    if (md > 0) people++;
    manDays += md;
    idle += idleManDays(a.status, a.idleHours, hoursPerManDay);
    if (a.status !== "idle") idleHours += a.idleHours || 0;
    wages += md * dailyCost(a.employeeId);
  }
  return { people, manDays, workingManDays: manDays - idle, idleManDays: idle, idleHours, wages };
}
