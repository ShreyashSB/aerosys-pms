import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Activity, BarChart3, Building2, Calculator, ChevronRight, ClipboardList, FileSpreadsheet, FolderOpen, LayoutGrid, MapPin, Pencil, Plus, Receipt, Users, Wrench,
} from "lucide-react";
import { useCurrentUser } from "@/auth/AuthContext";
import { can, canManageProject } from "@/auth/permissions";
import { useScopedData } from "@/hooks/useAppData";
import { ErrorState, PageSkeleton } from "@/components/common/States";
import { ProjectStatusBadge } from "@/components/common/StatusBadges";
import { HealthBadge } from "@/components/common/Health";
import { CalcDrawer } from "@/components/common/CalcDrawer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectFormDialog } from "@/features/projects/ProjectFormDialog";
import { ExpenseFormDialog } from "@/features/expenses/ExpenseFormDialog";
import { ExpenseTable } from "@/features/expenses/ExpenseTable";
import { OverviewTab } from "@/features/projects/tabs/OverviewTab";
import { PerformanceTab } from "@/features/projects/tabs/PerformanceTab";
import { BoqTab } from "@/features/projects/tabs/BoqTab";
import { DailyLogTab } from "@/features/projects/tabs/DailyLogTab";
import { TeamTab } from "@/features/projects/tabs/TeamTab";
import { InstrumentsTab } from "@/features/projects/tabs/InstrumentsTab";
import { CostsTab } from "@/features/projects/tabs/CostsTab";
import { DocumentsTab } from "@/features/projects/tabs/DocumentsTab";
import { PnlDrawer } from "@/features/projects/PnlDrawer";
import { DailyLogFormDialog } from "@/features/projects/dailylog/DailyLogFormDialog";
import { DailyLogDetailDialog } from "@/features/projects/dailylog/DailyLogDetailDialog";
import { AttendanceSummaryDialog } from "@/features/projects/dailylog/AttendanceSummaryDialog";
import { explainMetric, type MetricKey } from "@/features/projects/explainers";
import type { Explanation } from "@/domain/explain";
import { ForbiddenPage, NotFoundPage } from "./StatusPages";
import { formatDate, formatINR, formatINRShort } from "@/lib/format";
import { sum } from "@/lib/utils";

export function ProjectDetailPage() {
  const { id = "" } = useParams();
  const { user } = useCurrentUser();
  const data = useScopedData();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "overview";
  const setTab = (t: string) => setParams({ tab: t }, { replace: true });
  const [editOpen, setEditOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [pnlOpen, setPnlOpen] = useState(false);
  const [logForm, setLogForm] = useState<{ open: boolean; logId: string | null }>({ open: false, logId: null });
  const [viewLog, setViewLog] = useState<string | null>(null);
  const [attendanceOpen, setAttendanceOpen] = useState(false);

  if (data.isLoading) return <PageSkeleton />;
  if (data.error) return <ErrorState error={data.error} />;
  const project = data.projectById.get(id);
  if (!project) return <NotFoundPage />;
  if (!data.scopedProjectIds.has(id)) return <ForbiddenPage />;

  const p = data.perf.get(id)!;
  const health = data.health.get(id)!;
  const manager = data.employeeById.get(project.managerId);
  const assignments = data.assignments.filter((a) => a.projectId === id);
  const isManager = canManageProject(user, project);
  const isAssignedEngineer = assignments.some((a) => a.employeeId === user.employeeId && !a.endDate);
  const showFinance = can(user.role, "finance.view");
  const open = project.status === "active" || project.status === "on_hold";
  const canEdit = can(user.role, "project.edit") && isManager;
  const canLog = can(user.role, "log.create") && isManager && open;
  const canEditBoq = can(user.role, "boq.edit") && isManager && project.status !== "archived";
  const canAddExpense = can(user.role, "expense.create") && (user.role !== "site_engineer" || isAssignedEngineer) && open;
  const canEditCosts = can(user.role, "project.costs.edit") && (user.role !== "project_manager" || isManager);
  const explain = (k: MetricKey) => setExplanation(explainMetric(k, p, data.settings, data.employeeById));

  const projectExpenses = (user.role === "site_engineer" ? data.scopedExpenses : data.expenses).filter((e) => e.projectId === id);
  const pending = projectExpenses.filter((e) => e.status === "pending");
  const editingLog = logForm.logId ? data.dailyLogs.find((l) => l.id === logForm.logId) : null;

  const facts: Array<[string, React.ReactNode]> = [
    ["Project code", project.code],
    ["Client", <span className="flex items-center gap-1"><Building2 className="size-3.5 text-muted-foreground" />{project.clientName}</span>],
    ["Site", <span className="flex items-center gap-1"><MapPin className="size-3.5 text-muted-foreground" />{project.site}</span>],
    ["Project manager", manager?.name ?? "—"],
    ...(showFinance ? ([["Work order value", <span title={formatINR(project.contractValue)}>{formatINRShort(project.contractValue)}</span>]] as Array<[string, React.ReactNode]>) : []),
    ["Start date", formatDate(project.startDate)],
    ["Expected completion", formatDate(project.endDate)],
    ["Current status", <ProjectStatusBadge status={project.status} />],
  ];

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/projects" className="hover:text-foreground hover:underline">Projects</Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">{project.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-6 rounded-lg border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-3 text-xl font-semibold tracking-tight md:text-2xl">
              {project.name}
              <HealthBadge health={health} className="text-xs" />
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canLog && (
              <Button onClick={() => setLogForm({ open: true, logId: null })}>
                <ClipboardList /> New daily log
              </Button>
            )}
            {canAddExpense && (
              <Button variant="outline" onClick={() => setExpenseOpen(true)}>
                <Plus /> Add expense
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil /> Edit
              </Button>
            )}
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-4 text-sm sm:grid-cols-4">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 truncate font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview"><LayoutGrid /> Overview</TabsTrigger>
          <TabsTrigger value="performance"><BarChart3 /> Performance</TabsTrigger>
          <TabsTrigger value="boq"><FileSpreadsheet /> Annexure / BOQ</TabsTrigger>
          <TabsTrigger value="log"><Activity /> Daily Work Log</TabsTrigger>
          <TabsTrigger value="team"><Users /> Team</TabsTrigger>
          <TabsTrigger value="expenses">
            <Receipt /> Expenses {pending.length > 0 && <span className="rounded-full bg-warning-soft px-1.5 text-xs text-warning">{pending.length}</span>}
          </TabsTrigger>
          {showFinance && <TabsTrigger value="costs"><Calculator /> Costs</TabsTrigger>}
          <TabsTrigger value="instruments"><Wrench /> Instruments</TabsTrigger>
          <TabsTrigger value="documents"><FolderOpen /> Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            project={project}
            perf={p}
            settings={data.settings}
            showFinance={showFinance}
            onExplain={explain}
            onOpenPnl={() => setPnlOpen(true)}
            onOpenLog={setViewLog}
            onOpenAttendance={() => setAttendanceOpen(true)}
            onGoTab={setTab}
          />
        </TabsContent>
        <TabsContent value="performance">
          <PerformanceTab project={project} perf={p} showFinance={showFinance} onExplain={explain} onOpenPnl={() => setPnlOpen(true)} />
        </TabsContent>
        <TabsContent value="boq">
          <BoqTab project={project} perf={p} canEdit={canEditBoq} showAmounts={showFinance || isManager} onExplain={explain} />
        </TabsContent>
        <TabsContent value="log">
          <DailyLogTab
            projectId={id}
            perf={p}
            canLog={canLog}
            showCost={showFinance}
            onNew={() => setLogForm({ open: true, logId: null })}
            onOpenLog={setViewLog}
            onOpenAttendance={() => setAttendanceOpen(true)}
            onExplain={explain}
          />
        </TabsContent>
        <TabsContent value="team">
          <TeamTab
            project={project}
            perf={p}
            assignments={assignments}
            employeeById={data.employeeById}
            canAssign={can(user.role, "project.assign") && isManager}
            showCost={can(user.role, "rates.view")}
          />
        </TabsContent>
        <TabsContent value="expenses">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {showFinance && <>Allotted {formatINR(p.allottedExpenses)} · </>}
              Approved {formatINR(sum(projectExpenses.filter((e) => e.status === "approved"), (e) => e.amount))} · Pending {formatINR(sum(pending, (e) => e.amount))}
              {showFinance && <> · Remaining {formatINR(p.allottedExpenses - p.consumedExpenses)}</>}
            </p>
            {canAddExpense && (
              <Button onClick={() => setExpenseOpen(true)}>
                <Plus /> Add expense
              </Button>
            )}
          </div>
          <ExpenseTable
            expenses={projectExpenses}
            hideProject
            emptyAction={canAddExpense ? <Button variant="outline" onClick={() => setExpenseOpen(true)}><Plus /> Add expense</Button> : undefined}
          />
        </TabsContent>
        {showFinance && (
          <TabsContent value="costs">
            <CostsTab project={project} perf={p} settings={data.settings} costs={data.projectCosts.filter((c) => c.projectId === id)} canEdit={canEditCosts} onExplain={explain} />
          </TabsContent>
        )}
        <TabsContent value="instruments">
          <InstrumentsTab
            project={project}
            instruments={data.instruments}
            deployments={data.deployments}
            employeeById={data.employeeById}
            instrumentById={data.instrumentById}
            canManage={can(user.role, "instrument.manage") && isManager}
            showCost={showFinance}
            settings={data.settings}
          />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab projectId={id} canUpload={can(user.role, "document.upload") && (user.role !== "project_manager" || isManager)} onGoBoq={() => setTab("boq")} />
        </TabsContent>
      </Tabs>

      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
      <ExpenseFormDialog open={expenseOpen} onOpenChange={setExpenseOpen} projectId={project.id} />
      <CalcDrawer explanation={explanation} onClose={() => setExplanation(null)} />
      <PnlDrawer
        settings={data.settings}
        onClose={() => setPnlOpen(false)}
        data={
          pnlOpen && showFinance
            ? {
                title: project.name,
                contractValue: p.contractValue,
                costs: p.costs,
                earnedValue: p.earnedValue,
                remainingCost: p.remainingCost,
                finalCost: p.finalCost,
                finalProfit: p.finalProfit,
                finalMarginPct: p.finalMarginPct,
                projectionMethod: p.projectionMethod,
                progress: p.progress,
              }
            : null
        }
      />
      <DailyLogFormDialog open={logForm.open} onOpenChange={(o) => setLogForm((s) => ({ ...s, open: o }))} project={project} log={editingLog} />
      <DailyLogDetailDialog
        logId={viewLog}
        onClose={() => setViewLog(null)}
        canEdit={canLog}
        showCost={can(user.role, "rates.view")}
        onEdit={(logId) => {
          setViewLog(null);
          setLogForm({ open: true, logId });
        }}
      />
      <AttendanceSummaryDialog
        open={attendanceOpen}
        onOpenChange={setAttendanceOpen}
        projectId={id}
        showCost={can(user.role, "rates.view")}
        onOpenLog={(logId) => {
          setAttendanceOpen(false);
          setViewLog(logId);
        }}
      />
    </div>
  );
}
