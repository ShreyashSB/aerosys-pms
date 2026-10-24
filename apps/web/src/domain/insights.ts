/**
 * "Attention Required" — management insights generated from project data.
 * Language is deliberately neutral (At Risk / Needs Attention / Over Budget…).
 */
import { formatINR, formatNumber, formatPct } from "@/lib/format";
import type { AppSettings, Project } from "@/types/models";
import { HEALTH_THRESHOLDS as T } from "./assumptions";
import type { Tone } from "./health";
import type { ProjectPerformance } from "./performance";

export interface Insight {
  id: string;
  projectId: string;
  projectName: string;
  tone: Exclude<Tone, "neutral" | "good">;
  label: string;
  message: string;
  /** Where to look for detail (tab on the project page). */
  tab: string;
  weight: number;
}

export function generateInsights(projects: Project[], perf: Map<string, ProjectPerformance>, settings: AppSettings): Insight[] {
  const out: Insight[] = [];
  for (const project of projects) {
    if (project.status !== "active" && project.status !== "on_hold") continue;
    const p = perf.get(project.id);
    if (!p || p.consumedManDays === 0) continue;
    const add = (i: Omit<Insight, "id" | "projectId" | "projectName">) =>
      out.push({ ...i, id: `${project.id}:${i.label}:${i.tab}`, projectId: project.id, projectName: project.name });
    const prog = Math.max(p.progress, T.minProgressForRatios);

    const mdRatio = p.manDayUtilisation / prog;
    if (p.manDayUtilisation > 0.15 && mdRatio > T.manDayRatioWarn) {
      add({
        tone: mdRatio > T.manDayRatioBad ? "bad" : "warn",
        label: mdRatio > T.manDayRatioBad ? "At Risk" : "Needs Attention",
        message: `has consumed ${formatPct(p.manDayUtilisation * 100, 0)} of allotted man-days but is only ${formatPct(p.progress * 100, 0)} complete.`,
        tab: "performance",
        weight: mdRatio,
      });
    }

    if (p.consumedExpenses > 0) {
      const planned = p.allottedExpenses * prog;
      const over = planned > 0 ? (p.consumedExpenses / planned - 1) * 100 : 0;
      if (over > (T.expenseRatioWarn - 1) * 100) {
        add({
          tone: over > (T.expenseRatioBad - 1) * 100 ? "bad" : "warn",
          label: "Over Budget",
          message: `is ${formatPct(over, 0)} over its planned expense consumption (${formatINR(p.consumedExpenses)} spent at ${formatPct(p.progress * 100, 0)} progress).`,
          tab: "costs",
          weight: 1 + over / 100,
        });
      }
    }

    if (p.ppiVariancePct < T.runningPpiGood - 0.0001 && p.ppiVariancePct < 0) {
      add({
        tone: p.ppiVariancePct < T.runningPpiBad ? "bad" : "warn",
        label: "Below Baseline",
        message: `running PPI is ${formatINR(p.runningPpi)}/MD — ${formatPct(Math.abs(p.ppiVariancePct), 0)} below the ${formatINR(p.ppi)}/MD baseline.`,
        tab: "performance",
        weight: 1 + Math.abs(p.ppiVariancePct) / 50,
      });
    }

    const idleShare = (p.idleManDays / p.consumedManDays) * 100;
    if (idleShare > T.idleShareWarn && p.idleManDays >= 3) {
      const top = Object.entries(p.idleByReason).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
      add({
        tone: idleShare > T.idleShareBad ? "bad" : "warn",
        label: "Needs Attention",
        message: `has accumulated ${formatNumber(p.idleManDays, 1)} idle man-days (${formatPct(idleShare, 0)} of consumption)${top ? `, mainly “${top[0]}”` : ""}.`,
        tab: "log",
        weight: 1 + idleShare / 20,
      });
    }

    if (p.finalMarginPct < settings.targetMarginPct) {
      add({
        tone: p.finalMarginPct < T.marginBad ? "bad" : "warn",
        label: p.finalMarginPct < 0 ? "At Risk" : "Below Target",
        message: `is projected to finish at ${formatPct(p.finalMarginPct)} margin, below the ${formatPct(settings.targetMarginPct, 0)} target (estimate).`,
        tab: "overview",
        weight: 1.5 + (settings.targetMarginPct - p.finalMarginPct) / 20,
      });
    }

    const behind = (p.expectedProgress - p.progress) * 100;
    if (behind > T.progressBehindBad) {
      add({
        tone: "warn",
        label: "Behind Plan",
        message: `is ${formatPct(p.progress * 100, 0)} complete against ${formatPct(p.expectedProgress * 100, 0)} expected by today.`,
        tab: "performance",
        weight: 1 + behind / 50,
      });
    }
  }
  const rank = { bad: 2, warn: 1 };
  return out.sort((a, b) => rank[b.tone] - rank[a.tone] || b.weight - a.weight);
}
