import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import { useAppData } from "@/hooks/useAppData";
import { summariseLog } from "@/domain/performance";
import { EmptyState } from "@/components/common/States";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Recent daily logs for a project: people, working/idle MD, key work, expenses, remarks. */
export function DailyActivitySummary({
  projectId,
  limit,
  onOpen,
  showCost,
}: {
  projectId: string;
  limit?: number;
  onOpen: (logId: string) => void;
  showCost: boolean;
}) {
  const data = useAppData();
  const [pageSize, setPageSize] = useState(limit ?? 20);
  const all = useMemo(() => {
    const logs = data.dailyLogs.filter((l) => l.projectId === projectId).sort((a, b) => b.date.localeCompare(a.date));
    const itemById = new Map(data.boqItems.map((b) => [b.id, b]));
    return logs.map((log) => {
      const s = summariseLog(log.attendance, data.settings.hoursPerManDay, (id) => data.employeeById.get(id)?.dailyCost ?? 0);
      const work = data.boqExecutions
        .filter((x) => x.dailyLogId === log.id)
        .map((x) => {
          const it = itemById.get(x.boqItemId);
          return it ? `${it.description.split(/[–(]/)[0]!.trim()} — ${formatNumber(x.qty, 2)} ${it.uom}` : "";
        })
        .filter(Boolean);
      const exp = data.expenses.filter((e) => e.dailyLogId === log.id && e.status !== "rejected").reduce((acc, e) => acc + e.amount, 0);
      return { log, s, work, exp };
    });
  }, [data, projectId]);
  const rows = all.slice(0, pageSize);

  if (!all.length) return <EmptyState icon={<ClipboardList />} title="No daily logs yet" description="Daily logs record attendance, man-days, idle time and work done against the BOQ." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted-foreground">
          <tr className="border-b">
            <th className="px-5 py-2 text-left font-medium">Date</th>
            <th className="px-3 py-2 text-right font-medium">People</th>
            <th className="px-3 py-2 text-right font-medium">Working MD</th>
            <th className="px-3 py-2 text-right font-medium">Idle MD</th>
            <th className="px-3 py-2 text-left font-medium">Key work completed</th>
            {showCost && <th className="px-3 py-2 text-right font-medium">Expenses</th>}
            <th className="px-5 py-2 text-left font-medium">Remarks</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(({ log, s, work, exp }) => (
            <tr key={log.id} onClick={() => onOpen(log.id)} className="cursor-pointer hover:bg-muted/50">
              <td className="whitespace-nowrap px-5 py-2.5 font-medium">{formatDate(log.date)}</td>
              <td className="px-3 py-2.5 text-right tabular">{s.people}</td>
              <td className="px-3 py-2.5 text-right tabular">{formatNumber(s.workingManDays, 1)}</td>
              <td className={cn("px-3 py-2.5 text-right tabular", s.idleManDays > 0 && "font-medium text-warning")}>{formatNumber(s.idleManDays, 1)}</td>
              <td className="max-w-80 px-3 py-2.5">
                <p className="truncate" title={work.join("; ") || log.activities}>{work.length ? work.join("; ") : <span className="text-muted-foreground">{log.activities || "—"}</span>}</p>
              </td>
              {showCost && <td className="px-3 py-2.5 text-right tabular">{exp ? formatINR(exp) : "—"}</td>}
              <td className="max-w-56 truncate px-5 py-2.5 text-muted-foreground" title={log.remarks}>{log.remarks || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!limit && all.length > rows.length && (
        <div className="border-t px-5 py-2 text-center">
          <Button variant="ghost" size="sm" onClick={() => setPageSize((n) => n + 30)}>
            Show more ({all.length - rows.length} earlier logs)
          </Button>
        </div>
      )}
    </div>
  );
}
