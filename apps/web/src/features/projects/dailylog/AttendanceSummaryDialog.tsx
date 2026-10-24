import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { useAppData } from "@/hooks/useAppData";
import { ATTENDANCE_LABEL, idleManDays, MAN_DAY_WEIGHT } from "@/domain/assumptions";
import { addDays, parseISODate, todayISO } from "@/lib/dates";
import { formatINR, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AttendanceStatus, IdleReason } from "@/types/models";
import { STATUS_STYLE } from "./statusStyles";

const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" });

/** Attendance matrix (people × days) with man-day, idle and wage totals. */
export function AttendanceSummaryDialog({
  open,
  onOpenChange,
  projectId,
  showCost,
  onOpenLog,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  showCost: boolean;
  onOpenLog: (logId: string) => void;
}) {
  const data = useAppData();
  const [range, setRange] = useState("14");
  const hours = data.settings.hoursPerManDay;

  const view = useMemo(() => {
    const logs = data.dailyLogs.filter((l) => l.projectId === projectId);
    const last = logs.reduce((m, l) => (l.date > m ? l.date : m), "") || todayISO();
    const from = range === "all" ? logs.reduce((m, l) => (l.date < m ? l.date : m), last) : addDays(last, -(Number(range) - 1));
    const inRange = logs.filter((l) => l.date >= from && l.date <= last);
    const byDate = new Map(inRange.map((l) => [l.date, l]));
    const dates: string[] = [];
    for (let d = from; d <= last; d = addDays(d, 1)) dates.push(d);
    const people = new Map<string, { md: number; idle: number; wages: number; cells: Map<string, AttendanceStatus>; idleCell: Set<string> }>();
    const idleByReason = new Map<IdleReason, number>();
    let totalMd = 0;
    let totalIdle = 0;
    for (const l of inRange)
      for (const a of l.attendance) {
        let p = people.get(a.employeeId);
        if (!p) people.set(a.employeeId, (p = { md: 0, idle: 0, wages: 0, cells: new Map(), idleCell: new Set() }));
        const md = MAN_DAY_WEIGHT[a.status];
        const imd = idleManDays(a.status, a.idleHours, hours);
        p.md += md;
        p.idle += imd;
        p.wages += md * (data.employeeById.get(a.employeeId)?.dailyCost ?? 0);
        p.cells.set(l.date, a.status);
        if (a.idleHours > 0) p.idleCell.add(l.date);
        totalMd += md;
        totalIdle += imd;
        if (imd > 0) idleByReason.set(a.idleReason ?? "Other", (idleByReason.get(a.idleReason ?? "Other") ?? 0) + imd);
      }
    return { dates, byDate, people: [...people.entries()].sort((a, b) => b[1].md - a[1].md), totalMd, totalIdle, idleByReason: [...idleByReason.entries()].sort((a, b) => b[1] - a[1]), logs: inRange.length };
  }, [data, projectId, range, hours]);

  const maxReason = Math.max(1, ...view.idleByReason.map(([, v]) => v));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl"
        title="Attendance & work summary"
        description={data.projectById.get(projectId)?.name}
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Select value={range} onChange={(e) => setRange(e.target.value)} className="w-auto" aria-label="Period">
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
              <option value="all">Entire project</option>
            </Select>
            <span className="text-muted-foreground">
              {view.logs} logs · <strong className="text-foreground">{formatNumber(view.totalMd, 1)}</strong> man-days · <strong className="text-warning">{formatNumber(view.totalIdle, 1)}</strong> idle man-days
            </span>
            <span className="ml-auto flex flex-wrap gap-2 text-[11px]">
              {(Object.keys(STATUS_STYLE) as AttendanceStatus[]).map((s) => (
                <span key={s} className="flex items-center gap-1"><span className={cn("rounded px-1", STATUS_STYLE[s].cls)}>{STATUS_STYLE[s].code}</span>{ATTENDANCE_LABEL[s]}</span>
              ))}
              <span className="flex items-center gap-1"><span className="rounded bg-success-soft px-1 text-success ring-1 ring-warning">W</span>partial idle</span>
            </span>
          </div>

          {range !== "all" || view.dates.length <= 45 ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="text-xs">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="sticky left-0 z-10 min-w-40 bg-muted px-3 py-2 text-left font-medium">Person</th>
                    {view.dates.map((d) => {
                      const log = view.byDate.get(d);
                      return (
                        <th key={d} className={cn("px-1 py-2 text-center font-medium", parseISODate(d).getDay() === 0 && "bg-muted")}>
                          {log ? (
                            <button className="whitespace-nowrap hover:text-primary hover:underline cursor-pointer" onClick={() => onOpenLog(log.id)}>{dayFmt.format(parseISODate(d))}</button>
                          ) : (
                            <span className="whitespace-nowrap opacity-60">{dayFmt.format(parseISODate(d))}</span>
                          )}
                        </th>
                      );
                    })}
                    <th className="px-3 py-2 text-right font-medium">MD</th>
                    <th className="px-3 py-2 text-right font-medium">Idle</th>
                    {showCost && <th className="px-3 py-2 text-right font-medium">Wages</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {view.people.map(([id, p]) => (
                    <tr key={id}>
                      <td className="sticky left-0 z-10 bg-surface px-3 py-1.5 font-medium">{data.employeeById.get(id)?.name}</td>
                      {view.dates.map((d) => {
                        const st = p.cells.get(d);
                        return (
                          <td key={d} className="px-0.5 py-1 text-center">
                            {st ? <span className={cn("inline-block min-w-6 rounded px-1 py-0.5", STATUS_STYLE[st].cls, p.idleCell.has(d) && "ring-1 ring-warning")} title={`${ATTENDANCE_LABEL[st]}${p.idleCell.has(d) ? " (partial idle)" : ""}`}>{STATUS_STYLE[st].code}</span> : <span className="text-muted-foreground/40">·</span>}
                          </td>
                        );
                      })}
                      <td className="px-3 py-1.5 text-right font-medium tabular">{formatNumber(p.md, 1)}</td>
                      <td className={cn("px-3 py-1.5 text-right tabular", p.idle > 0 && "text-warning")}>{formatNumber(p.idle, 1)}</td>
                      {showCost && <td className="px-3 py-1.5 text-right tabular">{formatINR(p.wages)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Person</th>
                    <th className="px-3 py-2 text-right font-medium">Days on project</th>
                    <th className="px-3 py-2 text-right font-medium">Man-days</th>
                    <th className="px-3 py-2 text-right font-medium">Idle MD</th>
                    {showCost && <th className="px-3 py-2 text-right font-medium">Wages</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {view.people.map(([id, p]) => (
                    <tr key={id}>
                      <td className="px-3 py-2 font-medium">{data.employeeById.get(id)?.name}</td>
                      <td className="px-3 py-2 text-right tabular">{p.cells.size}</td>
                      <td className="px-3 py-2 text-right tabular">{formatNumber(p.md, 1)}</td>
                      <td className={cn("px-3 py-2 text-right tabular", p.idle > 0 && "text-warning")}>{formatNumber(p.idle, 1)}</td>
                      {showCost && <td className="px-3 py-2 text-right tabular">{formatINR(p.wages)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold">Why was manpower idle?</h3>
            {view.idleByReason.length === 0 ? (
              <p className="text-sm text-muted-foreground">No idle time in this period.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {view.idleByReason.map(([r, v]) => (
                  <li key={r} className="grid grid-cols-[10rem_1fr_4rem] items-center gap-3">
                    <span className="text-muted-foreground">{r}</span>
                    <span className="h-2 rounded-sm bg-muted"><span className="block h-full rounded-r-[4px] bg-warning" style={{ width: `${(v / maxReason) * 100}%` }} /></span>
                    <span className="text-right tabular">{formatNumber(v, 1)} MD</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
