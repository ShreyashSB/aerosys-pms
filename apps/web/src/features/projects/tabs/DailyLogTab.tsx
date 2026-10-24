import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/common/KpiCard";
import { idleHealth, manDayHealth } from "@/domain/health";
import type { ProjectPerformance } from "@/domain/performance";
import { formatDate, formatNumber, formatPct } from "@/lib/format";
import { DailyActivitySummary } from "../dailylog/DailyActivitySummary";
import type { MetricKey } from "../explainers";

export function DailyLogTab({
  projectId,
  perf: p,
  canLog,
  showCost,
  onNew,
  onOpenLog,
  onOpenAttendance,
  onExplain,
}: {
  projectId: string;
  perf: ProjectPerformance;
  canLog: boolean;
  showCost: boolean;
  onNew: () => void;
  onOpenLog: (id: string) => void;
  onOpenAttendance: () => void;
  onExplain: (k: MetricKey) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Daily logs drive consumed man-days, idle days, wages and — through work lines — BOQ execution and progress.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onOpenAttendance}><CalendarDays /> View Attendance & Work Summary</Button>
          {canLog && <Button onClick={onNew}><Plus /> New daily log</Button>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Daily logs" value={p.logCount} sub={p.lastLogDate ? `Last: ${formatDate(p.lastLogDate)}` : "None yet"} />
        <KpiCard label="Consumed man-days" value={`${formatNumber(p.consumedManDays, 1)} MD`} health={manDayHealth(p)} sub={`of ${formatNumber(p.allottedManDays)} allotted`} onClick={() => onExplain("manDays")} />
        <KpiCard label="Working man-days" value={`${formatNumber(p.workingManDays, 1)} MD`} sub="On-site + off-site, net of idle" />
        <KpiCard
          label="Idle days"
          value={`${formatNumber(p.idleManDays, 1)} MD`}
          health={idleHealth(p)}
          sub={p.consumedManDays ? `${formatPct((p.idleManDays / p.consumedManDays) * 100, 0)} of consumed` : undefined}
          onClick={() => onExplain("idle")}
        />
      </div>
      <Card className="py-2">
        <DailyActivitySummary projectId={projectId} onOpen={onOpenLog} showCost={showCost} />
      </Card>
    </div>
  );
}
