/**
 * "How was this calculated?" — equation-style explanations for key metrics.
 * Built from the same ProjectPerformance values the KPIs show, so the
 * explanation can never disagree with the number on screen.
 */
import { formatINR, formatNumber, formatPct } from "@/lib/format";
import type { AppSettings, Employee } from "@/types/models";
import { HEALTH_THRESHOLDS, MIN_PROGRESS_FOR_PERFORMANCE_PROJECTION, PROJECTION_LABEL } from "./assumptions";
import type { PortfolioPerformance, ProjectPerformance } from "./performance";

export interface CalcStep {
  op?: "+" | "−" | "×" | "÷" | "=";
  label: string;
  value: string;
  strong?: boolean;
}

export interface Explanation {
  title: string;
  subtitle?: string;
  steps: CalcStep[];
  notes?: string[];
}

const md = (n: number) => `${formatNumber(n, 1)} MD`;
const perMd = (n: number) => `${formatINR(n)} / MD`;
const pct = (n: number) => formatPct(n * 100);

export function explainPpi(p: ProjectPerformance): Explanation {
  return {
    title: "PPI (baseline)",
    subtitle: "Planned value earned per man-day",
    steps: [
      { label: "Work order value", value: formatINR(p.contractValue) },
      { op: "÷", label: "Allotted man-days", value: md(p.allottedManDays) },
      { op: "=", label: "PPI", value: perMd(p.ppi), strong: true },
    ],
    notes: ["Working hypothesis: PPI = Work Order Value ÷ Allotted Man-Days. Formula is configurable in src/domain/assumptions.ts until Aerosys confirms the definition."],
  };
}

export function explainRunningPpi(p: ProjectPerformance): Explanation {
  return {
    title: "Running PPI",
    subtitle: "Value actually earned per man-day consumed",
    steps: [
      { label: "Current progress (from BOQ)", value: pct(p.progress) },
      { op: "×", label: "Work order value", value: formatINR(p.contractValue) },
      { op: "=", label: "Earned value", value: formatINR(p.earnedValue), strong: true },
      { op: "÷", label: "Consumed man-days", value: md(p.consumedManDays) },
      { op: "=", label: "Running PPI", value: p.consumedManDays ? perMd(p.runningPpi) : "—", strong: true },
      { label: "Baseline PPI", value: perMd(p.ppi) },
      { op: "=", label: "Variance", value: `${p.ppiVariance >= 0 ? "+" : "−"}${perMd(Math.abs(p.ppiVariance))} (${p.ppiVariancePct >= 0 ? "+" : ""}${formatPct(p.ppiVariancePct)})`, strong: true },
    ],
    notes: [
      "Demo assumption: Running PPI = Earned Value ÷ Consumed Man-Days.",
      `Above baseline by ≥${HEALTH_THRESHOLDS.runningPpiGood}% is green; more than ${Math.abs(HEALTH_THRESHOLDS.runningPpiBad)}% below is red.`,
    ],
  };
}

export function explainProgress(p: ProjectPerformance): Explanation {
  return {
    title: "Progress",
    subtitle: "Value-weighted execution against the Annexure / BOQ",
    steps: [
      { label: "Executed value (Σ executed qty × rate)", value: formatINR(p.executedValue) },
      { op: "÷", label: `Total BOQ value (${p.boqItemCount} items)`, value: formatINR(p.boqValue) },
      { op: "=", label: "Progress", value: pct(p.progress), strong: true },
      { label: "Expected by today (linear plan)", value: pct(p.expectedProgress) },
      { op: "=", label: "Ahead / behind plan", value: `${p.progress >= p.expectedProgress ? "+" : "−"}${formatNumber(Math.abs(p.progress - p.expectedProgress) * 100, 1)} pts`, strong: true },
    ],
    notes: [
      `Expected progress = days elapsed (${p.elapsedDays}) ÷ planned duration (${p.totalDays}) — demo assumption of a linear schedule.`,
      "Weighted by value, so a ₹5 L item counts more than a ₹50,000 item.",
    ],
  };
}

export function explainManDays(p: ProjectPerformance, hoursPerManDay: number): Explanation {
  return {
    title: "Consumed man-days",
    subtitle: `From ${p.logCount} daily work logs`,
    steps: [
      { label: "On-site + off-site working man-days", value: md(p.workingManDays) },
      { op: "+", label: "Idle man-days (paid, unproductive)", value: md(p.idleManDays) },
      { op: "=", label: "Consumed man-days", value: md(p.consumedManDays), strong: true },
      { op: "÷", label: "Allotted man-days", value: md(p.allottedManDays) },
      { op: "=", label: "Man-day utilisation", value: pct(p.manDayUtilisation), strong: true },
      { label: "Progress achieved", value: pct(p.progress) },
      { label: "Planned man-days by today", value: md(p.plannedManDaysToDate) },
    ],
    notes: [
      "Each On-Site, Off-Site or Idle attendance entry = 1 man-day. Weekly off, holiday and leave = 0.",
      `Partial idle hours are converted at ${hoursPerManDay} working hours per man-day (Settings).`,
      "Healthy when utilisation stays in step with progress.",
    ],
  };
}

export function explainIdle(p: ProjectPerformance, hoursPerManDay: number): Explanation {
  const reasons = Object.entries(p.idleByReason).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  return {
    title: "Idle man-days",
    subtitle: "Σ idle person-days — 5 people idle for 2 days = 10 idle days",
    steps: [
      ...reasons.map(([r, v], i) => ({ op: i === 0 ? undefined : ("+" as const), label: r, value: md(v ?? 0) })),
      { op: "=", label: "Total idle man-days", value: md(p.idleManDays), strong: true },
      { label: "Share of consumed man-days", value: p.consumedManDays ? formatPct((p.idleManDays / p.consumedManDays) * 100) : "—" },
    ],
    notes: [`Includes ${formatNumber(p.idleHours, 0)} partial idle man-hours converted at ${hoursPerManDay} h per man-day.`],
  };
}

export function explainWages(p: ProjectPerformance, employeeById: Map<string, Employee>): Explanation {
  const top = p.byEmployee.slice(0, 6);
  const rest = p.byEmployee.slice(6);
  const steps: CalcStep[] = top.map((u, i) => {
    const e = employeeById.get(u.employeeId);
    return { op: i === 0 ? undefined : "+", label: `${e?.name ?? "—"} · ${formatNumber(u.manDays, 1)} MD × ${formatINR(e?.dailyCost ?? 0)}`, value: formatINR(u.wages) };
  });
  if (rest.length) steps.push({ op: "+", label: `${rest.length} others`, value: formatINR(rest.reduce((s, u) => s + u.wages, 0)) });
  steps.push({ op: "=", label: "Wages", value: formatINR(p.costs.wages), strong: true });
  return {
    title: "Wages",
    subtitle: "Consumed man-days × each person's Daily Cost",
    steps,
    notes: ["Daily Cost is an internal costing rate maintained on the employee profile — not derived from salary or CTC.", "Demo assumption: the current Daily Cost applies to all man-days, so rate changes re-price the project."],
  };
}

export function explainOverhead(p: ProjectPerformance, s: AppSettings): Explanation {
  return {
    title: "Overhead",
    steps: [
      { label: "Wages", value: formatINR(p.costs.wages) },
      { op: "×", label: "Overhead rate", value: formatPct(s.overheadPctOfWages) },
      { op: "=", label: "Overhead", value: formatINR(p.costs.overhead), strong: true },
    ],
    notes: ["Demo assumption: overhead is a % of wages. Rate is set in Settings; method to be confirmed by Aerosys."],
  };
}

export function explainManagement(p: ProjectPerformance, s: AppSettings): Explanation {
  return {
    title: "Management charges",
    steps: [
      { label: "Earned value", value: formatINR(p.earnedValue) },
      { op: "×", label: "Management rate", value: formatPct(s.managementPctOfEarnedValue) },
      { op: "=", label: "Management charges", value: formatINR(p.costs.management), strong: true },
    ],
    notes: ["Demo assumption: management charges accrue as a % of earned value. Rate is set in Settings."],
  };
}

export function explainInstruments(p: ProjectPerformance, s: AppSettings): Explanation {
  return {
    title: "Instrument charges",
    steps: [
      { label: "Σ purchase value × days deployed ÷ 30.4", value: "" },
      { op: "×", label: "Monthly usage rate", value: formatPct(s.instrumentMonthlyRatePct) },
      { op: "=", label: "Instrument charges", value: formatINR(p.costs.instruments), strong: true },
    ],
    notes: ["Demo assumption. See the Instruments tab for each deployment and its charge."],
  };
}

export function explainExpenses(p: ProjectPerformance): Explanation {
  return {
    title: "Consumed expenses",
    steps: [
      { label: "Approved expenses", value: formatINR(p.consumedExpenses) },
      { op: "÷", label: "Allotted expenses", value: formatINR(p.allottedExpenses) },
      { op: "=", label: "Expense utilisation", value: pct(p.expenseUtilisation), strong: true },
      { label: "Remaining expense budget", value: formatINR(p.allottedExpenses - p.consumedExpenses) },
      { label: "Planned expenses by today", value: formatINR(p.plannedExpensesToDate) },
      { label: "Pending approval (not yet counted)", value: formatINR(p.pendingExpenses) },
    ],
    notes: ["Only approved expenses count as consumed."],
  };
}

export function explainProjectedProfit(p: ProjectPerformance): Explanation {
  const notes = [PROJECTION_LABEL[p.projectionMethod]];
  if (p.projectionMethod === "budget") notes.push(`Budget method is used below ${MIN_PROGRESS_FOR_PERFORMANCE_PROJECTION * 100}% progress, or when selected in Settings.`);
  notes.push("Projected values are estimates, not actual profit.");
  return {
    title: "Projected final profit",
    steps: [
      { label: "Work order value", value: formatINR(p.contractValue) },
      { op: "−", label: "Actual cost to date", value: formatINR(p.costs.total) },
      { op: "−", label: "Projected remaining cost (estimate)", value: formatINR(p.remainingCost) },
      { op: "=", label: "Projected final profit", value: formatINR(p.finalProfit), strong: true },
      { label: "Projected margin", value: formatPct(p.finalMarginPct), strong: true },
    ],
    notes,
  };
}

export function explainPortfolioPpi(s: PortfolioPerformance): Explanation {
  return {
    title: "Portfolio PPI",
    subtitle: "Projects that have consumed man-days",
    steps: [
      { label: "Σ Earned value", value: formatINR(s.earnedValue) },
      { op: "÷", label: "Σ Consumed man-days", value: md(s.consumedManDays) },
      { op: "=", label: "Portfolio running PPI", value: perMd(s.runningPpi), strong: true },
      { label: "Portfolio baseline PPI (Σ WO value ÷ Σ allotted MD)", value: perMd(s.ppi) },
    ],
  };
}
