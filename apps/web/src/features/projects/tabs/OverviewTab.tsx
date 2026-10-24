import { ArrowRight, CalendarDays, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { KpiCard } from "@/components/common/KpiCard";
import { HealthBadge } from "@/components/common/Health";
import { CostBreakdown } from "@/features/dashboard/CostBreakdown";
import { expenseHealth, idleHealth, manDayHealth, profitHealth, progressHealth, runningPpiHealth, TONE_CLASSES } from "@/domain/health";
import type { ProjectPerformance } from "@/domain/performance";
import { formatDate, formatINR, formatINRShort, formatNumber, formatPct, formatPerMd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppSettings, Project } from "@/types/models";
import type { MetricKey } from "../explainers";
import { DailyActivitySummary } from "../dailylog/DailyActivitySummary";

export function OverviewTab({
  project,
  perf: p,
  settings,
  showFinance,
  onExplain,
  onOpenPnl,
  onOpenLog,
  onOpenAttendance,
  onGoTab,
}: {
  project: Project;
  perf: ProjectPerformance;
  settings: AppSettings;
  showFinance: boolean;
  onExplain: (k: MetricKey) => void;
  onOpenPnl: () => void;
  onOpenLog: (logId: string) => void;
  onOpenAttendance: () => void;
  onGoTab: (tab: string) => void;
}) {
  const sign = (n: number) => (n >= 0 ? "+" : "−");
  const profit = profitHealth(p.finalMarginPct, settings);
  const idleShare = p.consumedManDays ? (p.idleManDays / p.consumedManDays) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* KPI section */}
      <section aria-label="Key performance indicators" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="PPI (baseline)" value={formatPerMd(p.ppi)} sub="WO value ÷ allotted MD" onClick={() => onExplain("ppi")} />
        <KpiCard
          label="Running PPI"
          value={p.consumedManDays ? formatPerMd(p.runningPpi) : "—"}
          health={runningPpiHealth(p)}
          sub={p.consumedManDays ? `${sign(p.ppiVariancePct)}${formatPct(Math.abs(p.ppiVariancePct), 0)} vs baseline` : undefined}
          onClick={() => onExplain("runningPpi")}
        />
        <KpiCard
          label="Progress"
          value={formatPct(p.progress * 100)}
          health={progressHealth(p, project)}
          sub={project.status === "completed" ? undefined : `${formatPct(p.expectedProgress * 100, 0)} expected`}
          onClick={() => onExplain("progress")}
        />
        <KpiCard label="Allotted Man Days" value={`${formatNumber(p.allottedManDays)} MD`} sub={`${formatNumber(p.plannedManDaysToDate, 0)} MD planned by today`} />
        <KpiCard
          label="Consumed Man Days"
          value={`${formatNumber(p.consumedManDays, 1)} MD`}
          health={manDayHealth(p)}
          sub={`${formatPct(p.manDayUtilisation * 100, 0)} of allotted`}
          onClick={() => onExplain("manDays")}
        />
        <KpiCard
          label="Idle Days"
          value={`${formatNumber(p.idleManDays, 1)} MD`}
          health={idleHealth(p)}
          sub={p.consumedManDays ? `${formatPct(idleShare, 0)} of consumed` : undefined}
          onClick={() => onExplain("idle")}
        />
        {showFinance && (
          <>
            <KpiCard label="Allotted Expenses" value={formatINRShort(p.allottedExpenses)} sub={`${formatINRShort(p.allottedExpenses - p.consumedExpenses)} remaining`} />
            <KpiCard
              label="Consumed Expenses"
              value={formatINRShort(p.consumedExpenses)}
              health={expenseHealth(p)}
              sub={`${formatPct(p.expenseUtilisation * 100, 0)} of allotted`}
              onClick={() => onExplain("expenses")}
            />
            <KpiCard label="Wages" value={formatINRShort(p.costs.wages)} sub="MD × daily cost" onClick={() => onExplain("wages")} />
            <KpiCard label="Overhead" value={formatINRShort(p.costs.overhead)} sub={`${formatPct(settings.overheadPctOfWages, 0)} of wages`} onClick={() => onExplain("overhead")} />
            <KpiCard label="Instrument Charges" value={formatINRShort(p.costs.instruments)} sub="Deployment usage" onClick={() => onExplain("instruments")} />
            <KpiCard label="Management Charges" value={formatINRShort(p.costs.management)} sub={`${formatPct(settings.managementPctOfEarnedValue, 0)} of earned value`} onClick={() => onExplain("management")} />
          </>
        )}
      </section>

      {showFinance && (
        <div className="grid gap-6 xl:grid-cols-5">
          {/* Financial health – clickable P&L */}
          <Card className={cn("border-l-4 xl:col-span-2", TONE_CLASSES[profit.tone].border)}>
            <button type="button" onClick={onOpenPnl} className="group block w-full p-5 text-left cursor-pointer" aria-label="Open profit and loss breakdown">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Financial health</p>
                  <p className="text-xs text-muted-foreground">Projected outcome at completion (estimate)</p>
                </div>
                <HealthBadge health={profit} />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Projected profit</p>
              <p className={cn("text-3xl font-semibold tracking-tight tabular", TONE_CLASSES[profit.tone].text)}>
                {formatINRShort(p.finalProfit)} <span className="text-lg font-medium">· {formatPct(p.finalMarginPct)} margin</span>
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Work order value</dt><dd className="font-medium tabular">{formatINRShort(p.contractValue)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Earned value</dt><dd className="font-medium tabular">{formatINRShort(p.earnedValue)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Actual cost to date</dt><dd className="font-medium tabular">{formatINRShort(p.costs.total)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Projected final cost</dt><dd className="font-medium tabular">{formatINRShort(p.finalCost)}</dd></div>
              </dl>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline">
                View P&L breakdown <ArrowRight className="size-4" />
              </span>
            </button>
          </Card>

          <Card className="xl:col-span-3">
            <CardHeader>
              <div>
                <CardTitle>Where the money is going</CardTitle>
                <CardDescription>Actual cost to date by head — click a row for its calculation</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <CostBreakdown costs={p.costs} budget={p.budget} onSelect={(h) => onExplain(h as MetricKey)} />
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Daily activity summary</CardTitle>
            <CardDescription>
              {p.logCount} daily logs · last update {p.lastLogDate ? formatDate(p.lastLogDate) : "—"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onOpenAttendance}>
              <CalendarDays /> View Attendance & Work Summary
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onGoTab("log")}>All logs</Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <DailyActivitySummary projectId={project.id} limit={5} onOpen={onOpenLog} showCost={showFinance} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="size-4" /> Schedule</CardTitle>
            <CardDescription>{formatDate(project.startDate)} → {formatDate(project.endDate)} · {p.totalDays} days</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Time elapsed</span><span>{formatPct(p.expectedProgress * 100, 0)}</span></div>
            <Progress value={p.expectedProgress * 100} tone="warning" />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Work complete (BOQ value)</span><span>{formatPct(p.progress * 100, 1)}</span></div>
            <Progress value={p.progress * 100} tone={p.progress >= 1 ? "success" : "primary"} />
          </div>
          <p className="text-xs text-muted-foreground">
            Executed {formatINR(p.executedValue)} of {formatINR(p.boqValue)} BOQ value. {project.description}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
