/**
 * Two portfolio trend charts on the dashboard, shown in every style to roles that can see finance:
 * - "Earned value across N projects": cumulative earned value vs cost to date over the last 13 weeks.
 * - "In and out, week by week": earned value added (up) and cost added (down) per week, with the net as a line.
 * Colours come from the shared chart tokens (series-1 = earned, series-2 = cost), the same as the
 * "Earned value vs cost to date" bar chart, so the charts look the same in Standard, Studio and Calm.
 */
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { useScopedData } from "@/hooks/useAppData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { formatINR, formatINRShort, formatPct } from "@/lib/format";
import { cn, sum } from "@/lib/utils";
import { weeklyPortfolioSeries } from "./weeklySeries";

type Scoped = ReturnType<typeof useScopedData>;

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const fmtShort = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00`));
const axisTick = { fontSize: 11, fill: "var(--color-muted-foreground)" };
const tooltipStyle = { borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-foreground)", fontSize: 12 };

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular">{value}</p>
    </div>
  );
}

function ChartLegend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean; box?: boolean }> }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.box ? (
            <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          ) : (
            <span className="h-0 w-4 border-t-2" style={{ borderColor: i.color, borderStyle: i.dashed ? "dashed" : "solid" }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Pill toggle for the number of weeks shown. */
function WeeksToggle({ value, onChange }: { value: 6 | 13; onChange: (v: 6 | 13) => void }) {
  return (
    <div className="inline-flex shrink-0 rounded-full bg-muted p-0.5" role="group" aria-label="Weeks shown">
      {([6, 13] as const).map((w) => (
        <button
          key={w}
          type="button"
          aria-pressed={value === w}
          onClick={() => onChange(w)}
          className={cn("cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-colors", value === w ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {w} wks
        </button>
      ))}
    </div>
  );
}

export function PortfolioTrends({ data }: { data: Scoped }) {
  const [weeks, setWeeks] = useState<6 | 13>(13);
  const { scopedProjects, index, settings, portfolio: s, isLoading } = data;
  const series = useMemo(() => (isLoading ? [] : weeklyPortfolioSeries(scopedProjects, index, settings, 13)), [scopedProjects, index, settings, isLoading]);

  if (isLoading) {
    return (
      <div className="grid gap-6 xl:grid-cols-5">
        <Skeleton className="h-96 xl:col-span-3" />
        <Skeleton className="h-96 xl:col-span-2" />
      </div>
    );
  }

  const last4 = series.slice(-4);
  const earned4 = sum(last4, (w) => w.in);
  const spent4 = sum(last4, (w) => w.out);
  const monthAgo = series[series.length - 5];
  const evChange = monthAgo && monthAgo.earned ? ((s.earnedValue - monthAgo.earned) / monthAgo.earned) * 100 : 0;
  const shown = series.slice(-weeks).map((w) => ({ ...w, outNeg: -w.out }));

  return (
    <div className="grid gap-6 xl:grid-cols-5 [&>*]:min-w-0">
      <Card className="xl:col-span-3">
        <CardHeader>
          <div className="flex w-full flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Earned value across {s.projectCount} projects</CardTitle>
              <p data-slot="metric" className="mt-2 text-2xl font-semibold tabular">{formatINR(s.earnedValue)}</p>
              {monthAgo && (
                <p className="mt-1 flex items-center gap-2 text-sm">
                  <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold", evChange >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                    {evChange >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                    {formatPct(Math.abs(evChange))}
                  </span>
                  <span className="text-muted-foreground">on 4 weeks ago</span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Chip label="Earned, 4 wks" value={formatINRShort(earned4)} />
              <Chip label="Spent, 4 wks" value={formatINRShort(spent4)} />
              <Chip label="Earned − cost" value={formatINRShort(s.earnedValue - s.costToDate)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <AreaChart data={series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="trend-earned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-series-1)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--color-series-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 4" />
                <XAxis dataKey="date" tickFormatter={fmtShort} tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tickFormatter={(v) => formatINRShort(Number(v))} tick={axisTick} axisLine={false} tickLine={false} width={64} />
                <Tooltip
                  formatter={(v, n) => [formatINR(Number(v)), n === "earned" ? "Earned value" : "Cost to date"]}
                  labelFormatter={(l) => `Week ending ${fmtShort(String(l))}`}
                  contentStyle={tooltipStyle}
                />
                <Area type="monotone" dataKey="earned" stroke="var(--color-series-1)" strokeWidth={2.5} fill="url(#trend-earned)" />
                <Area type="monotone" dataKey="cost" stroke="var(--color-series-2)" strokeWidth={2} strokeDasharray="5 4" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend items={[{ label: "Earned value", color: "var(--color-series-1)" }, { label: "Cost to date", color: "var(--color-series-2)", dashed: true }]} />
        </CardContent>
      </Card>

      <Card className="flex flex-col xl:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>In and out, week by week</CardTitle>
            <CardDescription>Above the line is earned value added, below is cost. The line is each week's net.</CardDescription>
          </div>
          <WeeksToggle value={weeks} onChange={setWeeks} />
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          <div className="min-h-64 w-full flex-1">
            <ResponsiveContainer>
              <ComposedChart data={shown} stackOffset="sign" margin={{ left: 0, right: 8, top: 8, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 4" />
                <XAxis dataKey="date" tickFormatter={fmtShort} tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tickFormatter={(v) => formatINRShort(Number(v))} tick={axisTick} axisLine={false} tickLine={false} width={58} />
                <ReferenceLine y={0} stroke="var(--color-muted-foreground)" strokeOpacity={0.5} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)", opacity: 0.6 }}
                  formatter={(v, n) => [formatINR(Math.abs(Number(v))), n === "in" ? "Earned (in)" : n === "outNeg" ? "Cost (out)" : "Net"]}
                  labelFormatter={(l) => `Week ending ${fmtShort(String(l))}`}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="in" stackId="w" fill="var(--color-series-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outNeg" stackId="w" fill="var(--color-series-2)" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="net" stroke="var(--color-foreground)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend items={[{ label: "Earned (in)", color: "var(--color-series-1)", box: true }, { label: "Cost (out)", color: "var(--color-series-2)", box: true }, { label: "Net", color: "var(--color-foreground)" }]} />
        </CardContent>
      </Card>
    </div>
  );
}
