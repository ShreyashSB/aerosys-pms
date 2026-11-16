import { computeProjectPerformance, type PerformanceIndex } from "@/domain/performance";
import { addDays, todayISO } from "@/lib/dates";
import type { AppSettings, Project } from "@/types/models";

export interface WeekPoint {
  /** Last day of the week (ISO date). */
  date: string;
  /** Portfolio earned value and total cost, cumulative up to `date`. */
  earned: number;
  cost: number;
  /** What changed during this week: earned value added (money in) and cost added (money out), and the difference. */
  in: number;
  out: number;
  net: number;
}

/**
 * Week-by-week portfolio series for the dashboard trend charts. It uses the same engine as every other screen
 * (computeProjectPerformance "as of" each week end), so the last point matches the dashboard's tiles.
 * "In" is earned value added that week (work executed against the BOQ); "out" is cost added that week.
 */
export function weeklyPortfolioSeries(projects: Project[], index: PerformanceIndex, settings: AppSettings, weeks = 13): WeekPoint[] {
  const today = todayISO();
  const live = projects.filter((p) => p.status !== "archived");
  const ends = Array.from({ length: weeks + 1 }, (_, i) => addDays(today, -7 * (weeks - i)));
  const cumulative = ends.map((asOf) => {
    let earned = 0;
    let cost = 0;
    for (const p of live) {
      if (asOf < p.startDate) continue;
      const f = computeProjectPerformance(p, index, settings, asOf);
      earned += f.earnedValue;
      cost += f.costs.total;
    }
    return { date: asOf, earned, cost };
  });
  return cumulative.slice(1).map((c, i) => {
    const prev = cumulative[i]!;
    const inn = Math.max(0, c.earned - prev.earned);
    const out = Math.max(0, c.cost - prev.cost);
    return { date: c.date, earned: Math.round(c.earned), cost: Math.round(c.cost), in: Math.round(inn), out: Math.round(out), net: Math.round(inn - out) };
  });
}
