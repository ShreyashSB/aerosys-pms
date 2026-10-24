/**
 * KPI health classification. Thresholds live in `assumptions.ts`
 * (HEALTH_THRESHOLDS) and Settings (target margin) – not in components.
 *
 * good    = favourable / healthy
 * warn    = needs attention
 * bad     = unfavourable / concerning
 * neutral = informational (no good/bad interpretation)
 */
import type { AppSettings, Project } from "@/types/models";
import { HEALTH_THRESHOLDS as T } from "./assumptions";
import type { ProjectPerformance } from "./performance";

export type Tone = "good" | "warn" | "bad" | "neutral";
export interface Health {
  tone: Tone;
  label: string;
}

const neutral = (label = ""): Health => ({ tone: "neutral", label });
const notStarted = (p: ProjectPerformance) => p.consumedManDays === 0 && p.progress === 0;

/** Progress vs linear plan to date. */
export function progressHealth(p: ProjectPerformance, project: Project): Health {
  if (project.status === "completed") return { tone: "good", label: "Completed" };
  if (project.status === "planning") return neutral("Not started");
  const gap = (p.expectedProgress - p.progress) * 100;
  if (gap <= T.progressBehindWarn) return { tone: "good", label: gap <= 0 ? "Ahead of plan" : "On Track" };
  if (gap <= T.progressBehindBad) return { tone: "warn", label: "Behind plan" };
  return { tone: "bad", label: "At Risk" };
}

export function runningPpiHealth(p: ProjectPerformance): Health {
  if (p.consumedManDays === 0) return neutral("No man-days yet");
  if (p.ppiVariancePct >= T.runningPpiGood) return { tone: "good", label: "Above baseline" };
  if (p.ppiVariancePct >= T.runningPpiBad) return { tone: "warn", label: "Near baseline" };
  return { tone: "bad", label: "Below baseline" };
}

function ratioHealth(utilisation: number, progress: number, warn: number, bad: number, labels: [string, string, string]): Health {
  if (utilisation > 1) return { tone: "bad", label: labels[2] };
  const ratio = utilisation / Math.max(progress, T.minProgressForRatios);
  if (ratio <= warn) return { tone: "good", label: labels[0] };
  if (ratio <= bad) return { tone: "warn", label: labels[1] };
  return { tone: "bad", label: labels[2] };
}

/** Consumed man-days compared with work actually done. */
export function manDayHealth(p: ProjectPerformance): Health {
  if (notStarted(p)) return neutral("Not started");
  return ratioHealth(p.manDayUtilisation, p.progress, T.manDayRatioWarn, T.manDayRatioBad, ["Within plan", "Trending high", "Over consumption"]);
}

export function expenseHealth(p: ProjectPerformance): Health {
  if (p.consumedExpenses === 0) return neutral(p.allottedExpenses ? "Nothing consumed" : "");
  return ratioHealth(p.expenseUtilisation, p.progress, T.expenseRatioWarn, T.expenseRatioBad, ["Within budget", "Approaching budget", "Over Budget"]);
}

export function idleHealth(p: ProjectPerformance): Health {
  if (p.consumedManDays === 0) return neutral();
  const share = (p.idleManDays / p.consumedManDays) * 100;
  if (share <= T.idleShareWarn) return { tone: "good", label: "Low idle" };
  if (share <= T.idleShareBad) return { tone: "warn", label: "Moderate idle" };
  return { tone: "bad", label: "High idle" };
}

export function profitHealth(marginPct: number, settings: Pick<AppSettings, "targetMarginPct">): Health {
  if (marginPct < 0) return { tone: "bad", label: "Projected loss" };
  if (marginPct < T.marginBad) return { tone: "bad", label: "Below target" };
  if (marginPct < settings.targetMarginPct) return { tone: "warn", label: "Low margin" };
  return { tone: "good", label: "Healthy" };
}

/** Total cost to date vs budget consumed in step with progress. */
export function costHealth(p: ProjectPerformance): Health {
  if (p.costs.total === 0) return neutral();
  return ratioHealth(p.budgetUtilisation, p.progress, T.expenseRatioWarn, T.expenseRatioBad, ["Within budget", "Approaching budget", "Over Budget"]);
}

const RANK: Record<Tone, number> = { neutral: 0, good: 1, warn: 2, bad: 3 };

/** One status for tables: worst of the key execution & financial signals. */
export function overallHealth(p: ProjectPerformance, project: Project, settings: Pick<AppSettings, "targetMarginPct">): Health {
  if (project.status === "planning") return neutral("Not started");
  if (project.status === "archived") return neutral("Archived");
  const signals = [progressHealth(p, project), runningPpiHealth(p), manDayHealth(p), expenseHealth(p), idleHealth(p), profitHealth(p.finalMarginPct, settings)];
  const worst = signals.reduce((w, h) => (RANK[h.tone] > RANK[w.tone] ? h : w), { tone: "good", label: "" } as Health);
  if (project.status === "completed")
    return profitHealth(p.finalMarginPct, settings).tone === "good" ? { tone: "good", label: "Completed" } : { tone: "warn", label: "Completed · low margin" };
  if (worst.tone === "bad") return { tone: "bad", label: "At Risk" };
  if (worst.tone === "warn") return { tone: "warn", label: "Needs Attention" };
  return { tone: "good", label: "On Track" };
}

export const TONE_CLASSES: Record<Tone, { text: string; bg: string; border: string; dot: string }> = {
  good: { text: "text-success", bg: "bg-success-soft", border: "border-l-success", dot: "bg-success" },
  warn: { text: "text-warning", bg: "bg-warning-soft", border: "border-l-warning", dot: "bg-warning" },
  bad: { text: "text-danger", bg: "bg-danger-soft", border: "border-l-danger", dot: "bg-danger" },
  neutral: { text: "text-muted-foreground", bg: "bg-muted", border: "border-l-transparent", dot: "bg-muted-foreground" },
};
