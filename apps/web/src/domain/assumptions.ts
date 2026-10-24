/**
 * ════════════════════════════════════════════════════════════════════════
 *  BUSINESS FORMULAS & ASSUMPTIONS — the single place to change them.
 * ════════════════════════════════════════════════════════════════════════
 *
 * Several definitions are still to be confirmed by Aerosys HVAC. Every such
 * rule is implemented ONCE here (or read from Settings) and marked
 * `DEMO ASSUMPTION`. Components never re-implement these formulas; they read
 * results from `performance.ts` and explanations from `explain.ts`.
 */
import type { AppSettings, AttendanceStatus, IdleReason, ProjectionMethod } from "@/types/models";

// ---------------------------------------------------------------- man-days

/** Man-days consumed by one attendance entry, by status. */
export const MAN_DAY_WEIGHT: Record<AttendanceStatus, number> = {
  on_site: 1,
  off_site: 1, // working for the project away from site (office, vendor visit…)
  idle: 1, // present and paid but unable to work – consumed AND counted as idle
  weekly_off: 0,
  holiday: 0,
  leave: 0,
};

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  on_site: "On-Site Working",
  off_site: "Off-Site",
  idle: "Idle",
  weekly_off: "Weekly Off",
  holiday: "National Holiday",
  leave: "Leave",
};

export const IDLE_REASONS: IdleReason[] = [
  "Site not ready",
  "Material unavailable",
  "Client dependency",
  "Equipment unavailable",
  "Approval pending",
  "Design issue",
  "Weather",
  "Other",
];

/**
 * Idle man-days for one attendance entry.
 * Idle Days = Σ idle person-days (5 people idle for 2 days = 10 idle days).
 * Partial idle time is recorded in man-hours and converted with the
 * configurable `hoursPerManDay` setting (never hardcoded to 8 or 9).
 */
export function idleManDays(status: AttendanceStatus, idleHours: number, hoursPerManDay: number) {
  if (status === "idle") return MAN_DAY_WEIGHT.idle;
  if (MAN_DAY_WEIGHT[status] === 0 || !idleHours) return 0;
  return Math.min(1, idleHours / Math.max(1, hoursPerManDay));
}

// ---------------------------------------------------------------- PPI

/**
 * PPI (Performance / Productivity Index) — monetary value per man-day.
 * WORKING HYPOTHESIS (to be confirmed): PPI = Work Order Value ÷ Allotted Man-Days
 */
export function ppi(contractValue: number, allottedManDays: number) {
  return allottedManDays > 0 ? contractValue / allottedManDays : 0;
}

/**
 * Running PPI — value realised per man-day actually consumed.
 * DEMO ASSUMPTION: Running PPI = Earned Value ÷ Consumed Man-Days
 */
export function runningPpi(earned: number, consumedManDays: number) {
  return consumedManDays > 0 ? earned / consumedManDays : 0;
}

// ---------------------------------------------------------------- progress

/**
 * Progress is value-weighted execution against the Annexure / BOQ:
 *   Progress = Executed Value ÷ Total BOQ Value
 * (not an average of item percentages).
 */
export function progressFromBoq(executedValue: number, boqValue: number) {
  return boqValue > 0 ? Math.min(1, executedValue / boqValue) : 0;
}

/** Earned Value = Work Order Value × Progress */
export function earnedValue(contractValue: number, progress: number) {
  return contractValue * progress;
}

/**
 * Expected progress by a date.
 * DEMO ASSUMPTION: linear plan between start and expected completion.
 * Planned man-days and planned expenses to date follow the same curve.
 */
export function expectedProgress(elapsedDays: number, totalDays: number) {
  if (totalDays <= 0) return 1;
  return Math.min(1, Math.max(0, elapsedDays / totalDays));
}

// ---------------------------------------------------------------- cost heads

/**
 * Wages = consumed man-days × employee Daily Cost.
 * DEMO ASSUMPTION: the employee's CURRENT daily cost is applied to all
 * man-days, so a rate change re-prices the project immediately. Switch to
 * snapshotting the rate on each attendance entry if Aerosys prefers.
 */
export const WAGE_RATE_MODE = "current-daily-cost" as const;

/** DEMO ASSUMPTION: Overhead = x% of wages (x from Settings). */
export function overheadCost(wages: number, s: Pick<AppSettings, "overheadPctOfWages">) {
  return (wages * s.overheadPctOfWages) / 100;
}

/** DEMO ASSUMPTION: Management charges = x% of earned value (x from Settings). */
export function managementCost(earned: number, s: Pick<AppSettings, "managementPctOfEarnedValue">) {
  return (earned * s.managementPctOfEarnedValue) / 100;
}

/** DEMO ASSUMPTION: Instrument charge = purchase value × monthly rate × months deployed. */
export const DAYS_PER_MONTH = 30.4;
export function instrumentCharge(purchaseValue: number, days: number, s: Pick<AppSettings, "instrumentMonthlyRatePct">) {
  return (purchaseValue * (s.instrumentMonthlyRatePct / 100) * days) / DAYS_PER_MONTH;
}

// ---------------------------------------------------------------- projection

/** Below this progress, performance-based projection is too volatile; fall back to budget. */
export const MIN_PROGRESS_FOR_PERFORMANCE_PROJECTION = 0.1;

export const PROJECTION_LABEL: Record<ProjectionMethod | "actual", string> = {
  performance: "Cost to date ÷ progress — assumes current cost efficiency continues",
  budget: "Cost to date + budgeted cost of remaining work",
  actual: "Project complete — final cost equals actual cost",
};

/**
 * Projected final cost (an ESTIMATE – never presented as actual).
 *  performance: Final = Cost to Date ÷ Progress
 *  budget:      Final = Cost to Date + Budget × (1 − Progress)
 */
export function projectFinalCost(opts: {
  costToDate: number;
  progress: number;
  budget: number;
  completed: boolean;
  method: ProjectionMethod;
}): { finalCost: number; methodUsed: ProjectionMethod | "actual" } {
  const { costToDate, progress, budget, completed, method } = opts;
  if (completed || progress >= 1) return { finalCost: costToDate, methodUsed: "actual" };
  if (method === "performance" && progress >= MIN_PROGRESS_FOR_PERFORMANCE_PROJECTION)
    return { finalCost: costToDate / progress, methodUsed: "performance" };
  return { finalCost: costToDate + budget * (1 - progress), methodUsed: "budget" };
}

// ---------------------------------------------------------------- health thresholds

/**
 * KPI colour thresholds. Not yet confirmed by the client – tune here.
 * Ratios compare consumption % against progress % (1.0 = consuming exactly
 * in step with work done).
 */
export const HEALTH_THRESHOLDS = {
  /** Progress points behind the linear plan. */
  progressBehindWarn: 5,
  progressBehindBad: 15,
  /** Running PPI variance vs baseline (%). */
  runningPpiGood: 2,
  runningPpiBad: -10,
  /** Man-day utilisation ÷ progress. */
  manDayRatioWarn: 1.08,
  manDayRatioBad: 1.25,
  /** Expense utilisation ÷ progress. */
  expenseRatioWarn: 1.08,
  expenseRatioBad: 1.25,
  /** Idle man-days as % of consumed man-days. */
  idleShareWarn: 5,
  idleShareBad: 12,
  /** Projected margin below this is red (below settings.targetMarginPct is amber). */
  marginBad: 5,
  /** Ignore consumption ratios until this much progress exists. */
  minProgressForRatios: 0.05,
};

export const DEFAULT_SETTINGS: AppSettings = {
  companyName: "Aerosys HVAC Solutions Pvt Ltd",
  instrumentMonthlyRatePct: 3,
  deadlineAlertDays: 14,
  hoursPerManDay: 8,
  overheadPctOfWages: 20,
  managementPctOfEarnedValue: 3,
  projectionMethod: "performance",
  targetMarginPct: 15,
};
