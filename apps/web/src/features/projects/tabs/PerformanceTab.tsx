import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Calculator } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HealthBadge } from "@/components/common/Health";
import { useAppData } from "@/hooks/useAppData";
import { performanceSeries, type ProjectPerformance } from "@/domain/performance";
import { costHealth, expenseHealth, idleHealth, manDayHealth, profitHealth, progressHealth, runningPpiHealth, TONE_CLASSES, type Health } from "@/domain/health";
import { formatDate, formatINR, formatINRShort, formatNumber, formatPct, formatPerMd } from "@/lib/format";
import { parseISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/models";
import type { MetricKey } from "../explainers";

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" });

export function PerformanceTab({
  project,
  perf: p,
  showFinance,
  onExplain,
  onOpenPnl,
}: {
  project: Project;
  perf: ProjectPerformance;
  showFinance: boolean;
  onExplain: (k: MetricKey) => void;
  onOpenPnl: () => void;
}) {
  const data = useAppData();
  const series = useMemo(() => performanceSeries(project, data.index, data.settings), [project, data.index, data.settings]);
  const rPpiH = runningPpiHealth(p);
  const idleShare = p.consumedManDays ? (p.idleManDays / p.consumedManDays) * 100 : 0;
  const reasons = Object.entries(p.idleByReason).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  const maxReason = Math.max(1, ...reasons.map(([, v]) => v ?? 0));

  // Scale for the PPI gauge
  const scaleMax = Math.max(p.ppi, p.runningPpi) * 1.25 || 1;

  const planRows: Array<{ label: string; planned: number; actual: number; fmt: (n: number) => string; health: Health; note: string; lowerIsBetter: boolean; key?: MetricKey }> = [
    { label: "Progress", planned: p.expectedProgress * 100, actual: p.progress * 100, fmt: (n) => formatPct(n), health: progressHealth(p, project), note: "Linear plan to date vs BOQ execution", lowerIsBetter: false, key: "progress" },
    { label: "Man-day consumption", planned: p.plannedManDaysToDate, actual: p.consumedManDays, fmt: (n) => `${formatNumber(n, 0)} MD`, health: manDayHealth(p), note: "Planned to date vs consumed", lowerIsBetter: true, key: "manDays" },
  ];
  if (showFinance) {
    planRows.push(
      { label: "Expenses", planned: p.plannedExpensesToDate, actual: p.consumedExpenses, fmt: formatINRShort, health: expenseHealth(p), note: "Planned to date vs approved", lowerIsBetter: true, key: "expenses" },
      { label: "Total cost", planned: p.budget * p.expectedProgress, actual: p.costs.total, fmt: formatINRShort, health: costHealth(p), note: "Budget to date vs actual cost", lowerIsBetter: true },
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-5">
        {/* PPI panel */}
        <Card className={cn("border-l-4 xl:col-span-2", TONE_CLASSES[rPpiH.tone].border)}>
          <CardHeader>
            <div>
              <CardTitle>PPI vs Running PPI</CardTitle>
              <CardDescription>Value earned per man-day — plan vs actual</CardDescription>
            </div>
            <HealthBadge health={rPpiH} />
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Metric label="PPI (baseline)" value={formatPerMd(p.ppi)} onClick={() => onExplain("ppi")} />
              <Metric label="Running PPI" value={p.consumedManDays ? formatPerMd(p.runningPpi) : "—"} tone={rPpiH} onClick={() => onExplain("runningPpi")} />
              <Metric label="Variance" value={p.consumedManDays ? `${p.ppiVariance >= 0 ? "+" : "−"}${formatPerMd(Math.abs(p.ppiVariance))}` : "—"} tone={rPpiH} />
              <Metric label="Variance %" value={p.consumedManDays ? `${p.ppiVariancePct >= 0 ? "+" : ""}${formatPct(p.ppiVariancePct)}` : "—"} tone={rPpiH} />
            </dl>
            {p.consumedManDays > 0 && (
              <div aria-hidden>
                <div className="relative h-8">
                  <div className="absolute inset-x-0 top-3 h-2 rounded-full bg-muted" />
                  <div className={cn("absolute top-3 h-2 rounded-full", TONE_CLASSES[rPpiH.tone].dot)} style={{ width: `${(p.runningPpi / scaleMax) * 100}%` }} />
                  <div className="absolute top-0 h-8 w-0.5 bg-foreground" style={{ left: `${(p.ppi / scaleMax) * 100}%` }} />
                </div>
                <div className="relative h-4 text-[11px] text-muted-foreground">
                  <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(p.ppi / scaleMax) * 100}%` }}>Baseline {formatINRShort(p.ppi)}</span>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {p.consumedManDays === 0
                ? "No man-days consumed yet."
                : p.ppiVariancePct >= 0
                  ? `Each man-day is currently delivering ${formatINR(p.ppiVariance)} more work value than planned.`
                  : `Each man-day is currently delivering ${formatINR(Math.abs(p.ppiVariance))} less work value than planned.`}
            </p>
          </CardContent>
        </Card>

        {/* Plan vs actual */}
        <Card className="xl:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Plan vs actual (to date)</CardTitle>
              <CardDescription>Plan assumes linear progress between start and expected completion</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {planRows.map((r) => {
              const max = Math.max(r.planned, r.actual, 1);
              const diff = r.actual - r.planned;
              return (
                <div key={r.label}>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <button className={cn("text-sm font-medium", r.key && "hover:text-primary hover:underline cursor-pointer")} onClick={r.key ? () => onExplain(r.key!) : undefined} disabled={!r.key}>
                      {r.label}
                    </button>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {r.note}
                      <HealthBadge health={r.health} />
                    </span>
                  </div>
                  <div className="grid grid-cols-[4.5rem_1fr_6rem] items-center gap-x-3 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Planned</span>
                    <span className="h-2.5 rounded-sm bg-muted"><span className="block h-full rounded-r-[4px] bg-muted-foreground/40" style={{ width: `${(r.planned / max) * 100}%` }} /></span>
                    <span className="text-right tabular">{r.fmt(r.planned)}</span>
                    <span className="text-muted-foreground">Actual</span>
                    <span className="h-2.5 rounded-sm bg-muted"><span className={cn("block h-full rounded-r-[4px]", TONE_CLASSES[r.health.tone === "neutral" ? "neutral" : r.health.tone].dot)} style={{ width: `${(r.actual / max) * 100}%` }} /></span>
                    <span className="text-right font-medium tabular">
                      {r.fmt(r.actual)}{" "}
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        {diff >= 0 ? "+" : "−"}{r.fmt(Math.abs(diff))}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Analytical metrics */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Performance metrics</CardTitle>
            <CardDescription>Click a metric with <Calculator className="inline size-3" /> to see its calculation</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
            <Metric label="PPI" value={formatPerMd(p.ppi)} onClick={() => onExplain("ppi")} />
            <Metric label="Running PPI" value={p.consumedManDays ? formatPerMd(p.runningPpi) : "—"} tone={rPpiH} onClick={() => onExplain("runningPpi")} />
            <Metric label="PPI variance" value={p.consumedManDays ? `${p.ppiVariancePct >= 0 ? "+" : ""}${formatPct(p.ppiVariancePct)}` : "—"} tone={rPpiH} />
            <Metric label="Allotted MD" value={`${formatNumber(p.allottedManDays)} MD`} />
            <Metric label="Consumed MD" value={`${formatNumber(p.consumedManDays, 1)} MD`} tone={manDayHealth(p)} onClick={() => onExplain("manDays")} />
            <Metric label="Man-day utilisation" value={formatPct(p.manDayUtilisation * 100)} tone={manDayHealth(p)} />
            <Metric label="Progress" value={formatPct(p.progress * 100)} tone={progressHealth(p, project)} onClick={() => onExplain("progress")} />
            <Metric label="Expected progress" value={formatPct(p.expectedProgress * 100)} />
            <Metric label="Idle MD" value={`${formatNumber(p.idleManDays, 1)} MD (${formatPct(idleShare, 0)})`} tone={idleHealth(p)} onClick={() => onExplain("idle")} />
            {showFinance && (
              <>
                <Metric label="Expense utilisation" value={formatPct(p.expenseUtilisation * 100)} tone={expenseHealth(p)} onClick={() => onExplain("expenses")} />
                <Metric label="Cost to date" value={formatINRShort(p.costs.total)} tone={costHealth(p)} onClick={onOpenPnl} />
                <Metric label="Earned value" value={formatINRShort(p.earnedValue)} onClick={() => onExplain("runningPpi")} />
                <Metric label="Projected final cost" value={`${formatINRShort(p.finalCost)}*`} onClick={onOpenPnl} />
                <Metric label="Projected profit" value={`${formatINRShort(p.finalProfit)}*`} tone={profitHealth(p.finalMarginPct, data.settings)} onClick={() => onExplain("projectedProfit")} />
                <Metric label="Projected margin" value={`${formatPct(p.finalMarginPct)}*`} tone={profitHealth(p.finalMarginPct, data.settings)} onClick={onOpenPnl} />
              </>
            )}
          </dl>
          {showFinance && <p className="mt-4 text-xs text-muted-foreground">* Estimate — projected values are not actual results.</p>}
        </CardContent>
      </Card>

      {series.length > 1 && (
        <div className="grid gap-6 xl:grid-cols-2">
          {showFinance && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Are we earning more than we spend?</CardTitle>
                  <CardDescription>Cumulative earned value vs actual cost to date</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <TrendChart data={series} a={{ key: "earnedValue", label: "Earned value" }} b={{ key: "cost", label: "Cost to date" }} fmt={formatINRShort} tipFmt={formatINR} />
              </CardContent>
            </Card>
          )}
          <Card className={showFinance ? "" : "xl:col-span-2"}>
            <CardHeader>
              <div>
                <CardTitle>Man-day burn</CardTitle>
                <CardDescription>Cumulative consumed man-days vs linear plan</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <TrendChart data={series} a={{ key: "plannedMd", label: "Planned MD" }} b={{ key: "consumedMd", label: "Consumed MD" }} fmt={(n) => formatNumber(n)} tipFmt={(n) => `${formatNumber(n)} MD`} dashedA />
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Idle man-days by reason</CardTitle>
            <CardDescription>{formatNumber(p.idleManDays, 1)} idle MD — where manpower is being lost</CardDescription>
          </div>
          <HealthBadge health={idleHealth(p)} />
        </CardHeader>
        <CardContent>
          {reasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No idle time recorded.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {reasons.map(([r, v]) => (
                <li key={r} className="grid grid-cols-[11rem_1fr_5rem] items-center gap-3">
                  <span className="text-muted-foreground">{r}</span>
                  <span className="h-2.5 rounded-sm bg-muted"><span className="block h-full rounded-r-[4px] bg-warning" style={{ width: `${((v ?? 0) / maxReason) * 100}%` }} /></span>
                  <span className="text-right tabular">{formatNumber(v ?? 0, 1)} MD</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, tone, onClick }: { label: string; value: string; tone?: Health; onClick?: () => void }) {
  const cls = tone && tone.tone !== "neutral" ? TONE_CLASSES[tone.tone].text : "";
  const inner = (
    <>
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {onClick && <Calculator className="size-3 opacity-60" aria-hidden />}
      </dt>
      <dd className={cn("mt-0.5 font-semibold tabular", cls)}>{value}</dd>
      {tone && tone.label && tone.tone !== "neutral" && <dd className={cn("text-[11px]", cls)}>{tone.label}</dd>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="rounded-md p-1 -m-1 text-left hover:bg-muted/60 cursor-pointer">
      {inner}
    </button>
  ) : (
    <div>{inner}</div>
  );
}

type SeriesPoint = ReturnType<typeof performanceSeries>[number];

function TrendChart({
  data,
  a,
  b,
  fmt,
  tipFmt,
  dashedA,
}: {
  data: SeriesPoint[];
  a: { key: keyof SeriesPoint; label: string };
  b: { key: keyof SeriesPoint; label: string };
  fmt: (n: number) => string;
  tipFmt: (n: number) => string;
  dashedA?: boolean;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="date" tickFormatter={(d) => shortDate.format(parseISODate(d))} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tickFormatter={(v) => fmt(Number(v))} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} width={64} />
          <Tooltip
            formatter={(v, n) => [tipFmt(Number(v)), n === a.key ? a.label : b.label]}
            labelFormatter={(d) => formatDate(String(d))}
            contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
          />
          <Legend formatter={(v) => <span className="text-xs text-foreground">{v === a.key ? a.label : b.label}</span>} iconType="plainline" />
          <Line type="monotone" dataKey={a.key} stroke="var(--color-series-1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} animationDuration={500} strokeDasharray={dashedA ? "5 4" : undefined} />
          <Line type="monotone" dataKey={b.key} stroke="var(--color-series-2)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} animationDuration={500} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
