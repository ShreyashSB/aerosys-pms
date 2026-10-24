import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Clock, FolderKanban, Plus, Receipt, Wrench } from "lucide-react";
import { useCurrentUser } from "@/auth/AuthContext";
import { can, ROLE_LABELS } from "@/auth/permissions";
import { useScopedData } from "@/hooks/useAppData";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { KpiCard } from "@/components/common/KpiCard";
import { HealthBadge } from "@/components/common/Health";
import { CalcDrawer } from "@/components/common/CalcDrawer";
import { ErrorState, EmptyState } from "@/components/common/States";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress, Skeleton } from "@/components/ui/misc";
import { ProjectStatusBadge, InstrumentStatusBadge } from "@/components/common/StatusBadges";
import { CostBreakdown } from "@/features/dashboard/CostBreakdown";
import { ExpenseTable } from "@/features/expenses/ExpenseTable";
import { ExpenseFormDialog } from "@/features/expenses/ExpenseFormDialog";
import { ProjectFormDialog } from "@/features/projects/ProjectFormDialog";
import { PnlDrawer } from "@/features/projects/PnlDrawer";
import { expenseHealth, costHealth, profitHealth, runningPpiHealth, TONE_CLASSES, type Health } from "@/domain/health";
import { explainPortfolioPpi, type Explanation } from "@/domain/explain";
import { HEALTH_THRESHOLDS, MAN_DAY_WEIGHT } from "@/domain/assumptions";
import type { ProjectPerformance } from "@/domain/performance";
import { daysBetween, todayISO } from "@/lib/dates";
import { formatDate, formatINR, formatINRShort, formatNumber, formatPct, formatPerMd } from "@/lib/format";
import { cn, sum } from "@/lib/utils";
import type { Project } from "@/types/models";

export function DashboardPage() {
  const { user } = useCurrentUser();
  return user.role === "site_engineer" ? <EngineerDashboard /> : <PortfolioDashboard />;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

type Filter = "all" | "risk" | "budget" | "ppi";
type Row = { p: Project; f: ProjectPerformance; h: Health };

function PortfolioDashboard() {
  const { user, employee } = useCurrentUser();
  const data = useScopedData();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [pnlOpen, setPnlOpen] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [showAllInsights, setShowAllInsights] = useState(false);
  const { portfolio: s, scopedProjects: projects, perf, health, isLoading, error, settings, insights } = data;
  const showFinance = can(user.role, "finance.view");

  const rows = useMemo<Row[]>(
    () => projects.filter((p) => p.status !== "archived").map((p) => ({ p, f: perf.get(p.id)!, h: health.get(p.id)! })),
    [projects, perf, health],
  );
  const live = rows.filter((r) => r.p.status === "active" || r.p.status === "on_hold");
  const atRisk = live.filter((r) => r.h.tone === "bad");
  const overBudget = live.filter((r) => expenseHealth(r.f).tone === "bad" || costHealth(r.f).tone === "bad");
  const lowPpi = live.filter((r) => r.f.consumedManDays > 0 && r.f.ppiVariancePct < 0);
  const filtered = filter === "risk" ? atRisk : filter === "budget" ? overBudget : filter === "ppi" ? lowPpi : rows;

  const pendingForMe = useMemo(
    () => data.scopedExpenses.filter((e) => e.status === "pending" && (user.role !== "project_manager" || data.projectById.get(e.projectId)?.managerId === user.employeeId)),
    [data.scopedExpenses, data.projectById, user],
  );

  if (error) return <ErrorState error={error} />;

  const ppiVar = s.ppi ? ((s.runningPpi - s.ppi) / s.ppi) * 100 : 0;
  const ppiHealth: Health = s.consumedManDays === 0 ? { tone: "neutral", label: "" } : ppiVar >= HEALTH_THRESHOLDS.runningPpiGood ? { tone: "good", label: "Above baseline" } : ppiVar >= HEALTH_THRESHOLDS.runningPpiBad ? { tone: "warn", label: "Near baseline" } : { tone: "bad", label: "Below baseline" };
  const idleShare = s.consumedManDays ? (s.idleManDays / s.consumedManDays) * 100 : 0;
  const idleH: Health = idleShare <= HEALTH_THRESHOLDS.idleShareWarn ? { tone: "good", label: "Low idle" } : idleShare <= HEALTH_THRESHOLDS.idleShareBad ? { tone: "warn", label: "Moderate idle" } : { tone: "bad", label: "High idle" };
  const expRatio = s.expenseUtilisation / Math.max(s.progress, 0.05);
  const expH: Health = expRatio <= HEALTH_THRESHOLDS.expenseRatioWarn ? { tone: "good", label: "In step with progress" } : expRatio <= HEALTH_THRESHOLDS.expenseRatioBad ? { tone: "warn", label: "Running ahead" } : { tone: "bad", label: "Over trajectory" };
  const profitH = profitHealth(s.finalMarginPct, settings);
  const contributionTone: Health = s.earnedValue >= s.costToDate ? { tone: "good", label: `${formatINRShort(s.earnedValue - s.costToDate)} below earned value` } : { tone: "bad", label: "Exceeds earned value" };

  const columns: Column<Row>[] = [
    {
      key: "project",
      header: "Project",
      sortValue: (r) => r.p.name,
      cell: (r) => (
        <div className="min-w-44">
          <p className="font-medium">{r.p.name}</p>
          <p className="hidden text-xs text-muted-foreground 2xl:block">{r.p.clientName}</p>
        </div>
      ),
    },
    ...(showFinance ? [{ key: "value", header: "Contract value", align: "right" as const, sortValue: (r: Row) => r.p.contractValue, cell: (r: Row) => <span className="tabular" title={formatINR(r.p.contractValue)}>{formatINRShort(r.p.contractValue)}</span> }] : []),
    {
      key: "progress",
      header: "Progress",
      sortValue: (r) => r.f.progress,
      cell: (r) => (
        <div className="w-28">
          <div className="flex items-center gap-2">
            <Progress value={r.f.progress * 100} tone={r.f.progress >= 1 ? "success" : "primary"} />
            <span className="w-9 text-right text-xs tabular">{formatPct(r.f.progress * 100, 0)}</span>
          </div>
          {r.p.status === "active" && <p className="text-[11px] text-muted-foreground">plan {formatPct(r.f.expectedProgress * 100, 0)}</p>}
        </div>
      ),
    },
    {
      key: "md",
      header: "Consumed MD",
      align: "right",
      sortValue: (r) => r.f.manDayUtilisation,
      cell: (r) => (
        <span className="tabular">
          {formatNumber(r.f.consumedManDays, 0)}
          <span className="block text-[11px] text-muted-foreground">of {formatNumber(r.f.allottedManDays)}</span>
        </span>
      ),
    },
    { key: "ppi", header: "PPI", align: "right", className: "hidden 2xl:table-cell", sortValue: (r) => r.f.ppi, cell: (r) => <span className="tabular">{formatINRShort(r.f.ppi)}</span> },
    {
      key: "rppi",
      header: "Running PPI",
      align: "right",
      sortValue: (r) => r.f.ppiVariancePct,
      cell: (r) => {
        if (!r.f.consumedManDays) return <span className="text-muted-foreground">—</span>;
        const h = runningPpiHealth(r.f);
        return (
          <span className={cn("tabular font-medium", TONE_CLASSES[h.tone].text)} title={h.label}>
            {formatINRShort(r.f.runningPpi)}
            <span className="block text-[11px] font-normal">{r.f.ppiVariancePct >= 0 ? "+" : ""}{formatPct(r.f.ppiVariancePct, 0)}</span>
          </span>
        );
      },
    },
    ...(showFinance
      ? [
          {
            key: "exp",
            header: "Consumed exp.",
            align: "right" as const,
            sortValue: (r: Row) => r.f.expenseUtilisation,
            cell: (r: Row) => {
              const h = expenseHealth(r.f);
              return (
                <span className="tabular">
                  {formatINRShort(r.f.consumedExpenses)}
                  <span className={cn("block text-[11px]", h.tone === "neutral" ? "text-muted-foreground" : TONE_CLASSES[h.tone].text)}>{formatPct(r.f.expenseUtilisation * 100, 0)} of allotted</span>
                </span>
              );
            },
          },
          { key: "cost", header: "Total cost", align: "right" as const, sortValue: (r: Row) => r.f.costs.total, cell: (r: Row) => <span className="tabular">{formatINRShort(r.f.costs.total)}</span> },
          {
            key: "profit",
            header: "Projected profit*",
            align: "right" as const,
            sortValue: (r: Row) => r.f.finalMarginPct,
            cell: (r: Row) => {
              const h = profitHealth(r.f.finalMarginPct, settings);
              return (
                <span className={cn("tabular font-medium", TONE_CLASSES[h.tone].text)}>
                  {formatINRShort(r.f.finalProfit)}
                  <span className="block text-[11px] font-normal">{formatPct(r.f.finalMarginPct)} margin</span>
                </span>
              );
            },
          },
        ]
      : []),
    { key: "status", header: "Status", sortValue: (r) => ({ bad: 0, warn: 1, good: 2, neutral: 3 })[r.h.tone], cell: (r) => <div className="flex flex-col items-start gap-1"><HealthBadge health={r.h} /><ProjectStatusBadge status={r.p.status} /></div> },
  ];

  const chartRows = rows
    .filter((r) => r.f.costs.total > 0)
    .sort((a, b) => b.p.contractValue - a.p.contractValue)
    .map((r) => ({ name: r.p.name.length > 24 ? `${r.p.name.slice(0, 22)}…` : r.p.name, full: r.p.name, ev: Math.round(r.f.earnedValue), cost: Math.round(r.f.costs.total) }));

  const visibleInsights = showAllInsights ? insights : insights.slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${employee.name.split(" ")[0]}`}
        description={
          user.role === "project_manager"
            ? `Performance of the ${projects.length} projects you manage — are we executing efficiently, and making money?`
            : `${ROLE_LABELS[user.role]} view · Are we executing our projects efficiently, and are we making money on them?`
        }
        actions={
          <>
            {can(user.role, "expense.approve") && pendingForMe.length > 0 && (
              <Button variant="outline" onClick={() => navigate("/expenses?status=pending")}>
                <Receipt /> {pendingForMe.length} pending approval{pendingForMe.length > 1 ? "s" : ""}
              </Button>
            )}
            {can(user.role, "project.create") && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus /> New project
              </Button>
            )}
          </>
        }
      />

      {/* Financial KPIs */}
      {showFinance && (
        <section aria-label="Financial overview" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard size="lg" label="Total contract value" value={formatINRShort(s.contractValue)} sub={`${s.projectCount} projects`} loading={isLoading} />
          <KpiCard size="lg" label="Current earned value" value={formatINRShort(s.earnedValue)} sub={`${formatPct(s.progress * 100)} of portfolio executed`} loading={isLoading} />
          <KpiCard size="lg" label="Actual cost to date" value={formatINRShort(s.costToDate)} health={contributionTone} loading={isLoading} />
          <KpiCard size="lg" label="Projected final cost" value={formatINRShort(s.finalCost)} sub="Estimate" loading={isLoading} />
          <KpiCard
            size="lg"
            label="Projected profit"
            value={formatINRShort(s.finalProfit)}
            health={profitH}
            sub={`${formatPct(s.finalMarginPct)} margin · estimate`}
            onClick={() => setPnlOpen(true)}
            loading={isLoading}
          />
        </section>
      )}

      {/* Execution KPIs */}
      <section aria-label="Execution overview" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Portfolio running PPI"
          value={s.consumedManDays ? formatPerMd(s.runningPpi) : "—"}
          health={ppiHealth}
          sub={`Baseline ${formatPerMd(s.ppi)}`}
          onClick={() => setExplanation(explainPortfolioPpi(s))}
          loading={isLoading}
        />
        <KpiCard label="Man-days consumed" value={formatNumber(s.consumedManDays, 0)} sub={`of ${formatNumber(s.allottedManDays)} allotted`} loading={isLoading} />
        <KpiCard label="Idle man-days" value={formatNumber(s.idleManDays, 1)} health={idleH} sub={`${formatPct(idleShare, 1)} of consumed`} loading={isLoading} />
        {showFinance && (
          <KpiCard label="Expense utilisation" value={formatPct(s.expenseUtilisation * 100, 0)} health={expH} sub={`${formatINRShort(s.consumedExpenses)} of ${formatINRShort(s.allottedExpenses)}`} loading={isLoading} />
        )}
        <KpiCard label="Project completion" value={formatPct(s.progress * 100, 0)} sub={`${s.activeCount} active · ${s.completedCount} completed`} loading={isLoading} />
        <CountCard label="Projects at risk" count={atRisk.length} active={filter === "risk"} onClick={() => setFilter(filter === "risk" ? "all" : "risk")} loading={isLoading} />
        <CountCard label="Over budget" count={overBudget.length} active={filter === "budget"} onClick={() => setFilter(filter === "budget" ? "all" : "budget")} loading={isLoading} />
        <CountCard label="Below PPI baseline" count={lowPpi.length} active={filter === "ppi"} onClick={() => setFilter(filter === "ppi" ? "all" : "ppi")} loading={isLoading} />
      </section>

      {/* Attention required */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-warning" /> Attention required</CardTitle>
            <CardDescription>Generated from daily logs, BOQ execution and costs · {insights.length} observations</CardDescription>
          </div>
          {insights.length > 6 && (
            <Button variant="ghost" size="sm" onClick={() => setShowAllInsights((v) => !v)}>{showAllInsights ? "Show fewer" : `Show all ${insights.length}`}</Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-28" />
          ) : insights.length === 0 ? (
            <p className="flex items-center gap-2 py-4 text-sm text-success"><CheckCircle2 className="size-4" /> All running projects are on track.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleInsights.map((i) => (
                <Link
                  key={i.id}
                  to={`/projects/${i.projectId}?tab=${i.tab}`}
                  className={cn("group flex gap-3 rounded-md border border-l-4 p-3 transition-colors hover:bg-muted/50", TONE_CLASSES[i.tone].border)}
                >
                  {i.tone === "bad" ? <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />}
                  <div className="min-w-0 text-sm">
                    <HealthBadge health={{ tone: i.tone, label: i.label }} />
                    <p className="mt-1">
                      <span className="font-medium">{i.projectName}</span> {i.message}
                    </p>
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">Open project <ArrowRight className="size-3" /></span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project financial health */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Project financial health</CardTitle>
            <CardDescription>
              {filter === "all" ? "All projects" : filter === "risk" ? "Projects at risk" : filter === "budget" ? "Projects over budget" : "Projects below PPI baseline"} · click a row to open its control center
              {showFinance && " · * projected values are estimates"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1">
            {(["all", "risk", "budget", "ppi"] as Filter[]).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "risk" ? `At risk (${atRisk.length})` : f === "budget" ? `Over budget (${overBudget.length})` : `Below baseline (${lowPpi.length})`}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={filtered}
            columns={columns}
            rowKey={(r) => r.p.id}
            loading={isLoading}
            pageSize={15}
            onRowClick={(r) => navigate(`/projects/${r.p.id}`)}
            initialSort={{ key: "status", dir: "asc" }}
            empty={<EmptyState icon={<FolderKanban />} title="No projects in this view" />}
          />
        </CardContent>
      </Card>

      {showFinance && (
        <div className="grid gap-6 xl:grid-cols-5">
          <Card className="xl:col-span-3">
            <CardHeader>
              <div>
                <CardTitle>Earned value vs cost to date</CardTitle>
                <CardDescription>Where cost runs ahead of earned value, the project is consuming margin</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-80" />
              ) : (
                <div className="h-80 w-full">
                  <ResponsiveContainer>
                    <BarChart data={chartRows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }} barGap={2} barCategoryGap="24%">
                      <CartesianGrid horizontal={false} stroke="var(--color-border)" />
                      <XAxis type="number" tickFormatter={(v) => formatINRShort(Number(v))} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11, fill: "var(--color-foreground)" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: "var(--color-muted)" }}
                        formatter={(v, n) => [formatINR(Number(v)), n === "ev" ? "Earned value" : "Cost to date"]}
                        labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ""}
                        contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                      />
                      <Legend formatter={(v) => <span className="text-xs text-foreground">{v === "ev" ? "Earned value" : "Cost to date"}</span>} iconType="circle" iconSize={8} />
                      <Bar dataKey="ev" fill="var(--color-series-1)" radius={[0, 4, 4, 0]} maxBarSize={12} />
                      <Bar dataKey="cost" fill="var(--color-series-2)" radius={[0, 4, 4, 0]} maxBarSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="xl:col-span-2">
            <CardHeader>
              <div>
                <CardTitle>What we are spending on</CardTitle>
                <CardDescription>Portfolio cost to date by head</CardDescription>
              </div>
            </CardHeader>
            <CardContent>{isLoading ? <Skeleton className="h-64" /> : <CostBreakdown costs={s.costs} />}</CardContent>
          </Card>
        </div>
      )}

      {can(user.role, "expense.approve") && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Expenses awaiting approval</CardTitle>
              <CardDescription>
                {pendingForMe.length} claims · {formatINR(sum(pendingForMe, (e) => e.amount))} — approved claims are added to consumed expenses and project cost immediately
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/expenses?status=pending">Open expenses</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ExpenseTable expenses={pendingForMe} loading={isLoading} pageSize={5} />
          </CardContent>
        </Card>
      )}

      <ProjectFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <CalcDrawer explanation={explanation} onClose={() => setExplanation(null)} />
      <PnlDrawer
        settings={settings}
        onClose={() => setPnlOpen(false)}
        data={
          pnlOpen
            ? {
                title: `Portfolio · ${s.projectCount} projects`,
                contractValue: s.contractValue,
                costs: s.costs,
                earnedValue: s.earnedValue,
                remainingCost: s.finalCost - s.costToDate,
                finalCost: s.finalCost,
                finalProfit: s.finalProfit,
                finalMarginPct: s.finalMarginPct,
                projectionMethod: "mixed",
                progress: s.progress,
              }
            : null
        }
      />
    </div>
  );
}

function CountCard({ label, count, active, onClick, loading }: { label: string; count: number; active: boolean; onClick: () => void; loading?: boolean }) {
  const h: Health = count === 0 ? { tone: "good", label: "None" } : { tone: count > 2 ? "bad" : "warn", label: active ? "Filtered below" : "Show in table" };
  return (
    <KpiCard
      label={label}
      value={count}
      health={h}
      onClick={onClick}
      loading={loading}
      className={cn(active && "ring-2 ring-primary")}
    />
  );
}

function EngineerDashboard() {
  const { user, employee } = useCurrentUser();
  const data = useScopedData();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const { isLoading, error } = data;

  const myAssignments = data.assignments.filter((a) => a.employeeId === user.employeeId && !a.endDate);
  const myExpenses = data.scopedExpenses;
  const myInstruments = data.instruments.filter((i) => i.assignedEngineerId === user.employeeId);
  const pending = myExpenses.filter((e) => e.status === "pending");
  const month = todayISO().slice(0, 7);
  const myMonth = data.dailyLogs
    .filter((l) => l.date.startsWith(month))
    .flatMap((l) => l.attendance.filter((a) => a.employeeId === user.employeeId));
  const mdMonth = myMonth.reduce((acc, a) => acc + MAN_DAY_WEIGHT[a.status], 0);
  const idleMonth = myMonth.filter((a) => a.status === "idle").length;

  if (error) return <ErrorState error={error} />;

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${employee.name.split(" ")[0]}`}
        description={`${employee.designation} · ${employee.baseLocation}`}
        actions={
          <Button onClick={() => setExpenseOpen(true)}>
            <Plus /> Add expense
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active assignments" value={myAssignments.length} icon={<FolderKanban />} loading={isLoading} />
        <StatCard label="My man-days this month" value={formatNumber(mdMonth, 1)} icon={<Clock />} loading={isLoading} hint={idleMonth ? `${idleMonth} idle days logged` : "No idle days"} />
        <StatCard label="Pending claims" value={pending.length} icon={<Receipt />} loading={isLoading} hint={formatINR(sum(pending, (e) => e.amount))} />
        <StatCard label="Instruments with me" value={myInstruments.length} icon={<Wrench />} loading={isLoading} />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold">My assigned projects</h2>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : myAssignments.length === 0 ? (
        <Card><EmptyState icon={<FolderKanban />} title="No active assignments" description="Your project manager will assign you to a project." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {myAssignments.map((a) => {
            const p = data.projectById.get(a.projectId)!;
            const f = data.perf.get(p.id)!;
            const mine = f.byEmployee.find((u) => u.employeeId === user.employeeId);
            const daysLeft = daysBetween(todayISO(), p.endDate);
            return (
              <Link key={a.id} to={`/projects/${p.id}`}>
                <Card className="h-full p-5 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-sm text-muted-foreground">{p.site}</p>
                    </div>
                    <ProjectStatusBadge status={p.status} />
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <Progress value={f.progress * 100} />
                    <span className="text-sm font-medium tabular">{formatPct(f.progress * 100, 0)}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                    <div><p className="text-muted-foreground">My role</p><p className="font-medium">{a.role}</p></div>
                    <div><p className="text-muted-foreground">My man-days</p><p className="font-medium">{formatNumber(mine?.manDays ?? 0, 1)}</p></div>
                    <div><p className="text-muted-foreground">Manager</p><p className="font-medium">{data.employeeById.get(p.managerId)?.name}</p></div>
                    <div><p className="text-muted-foreground">Due</p><p className={daysLeft < 0 ? "font-medium text-danger" : "font-medium"}>{formatDate(p.endDate)}</p></div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Card className="mt-8">
        <CardHeader>
          <div>
            <CardTitle>My instruments</CardTitle>
            <CardDescription>Equipment issued to you</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild><Link to="/instruments">View all</Link></Button>
        </CardHeader>
        <CardContent>
          {myInstruments.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No instruments issued.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {myInstruments.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{i.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{i.code} · {data.projectById.get(i.assignedProjectId ?? "")?.name}</p>
                  </div>
                  <InstrumentStatusBadge status={i.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>My recent expenses</CardTitle>
            <CardDescription>Track the approval status of your claims</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild><Link to="/expenses">View all</Link></Button>
        </CardHeader>
        <CardContent>
          <ExpenseTable expenses={myExpenses} loading={isLoading} hideEmployee pageSize={5} />
        </CardContent>
      </Card>
      <ExpenseFormDialog open={expenseOpen} onOpenChange={setExpenseOpen} />
    </div>
  );
}
