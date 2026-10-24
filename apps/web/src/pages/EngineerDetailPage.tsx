import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Mail, MapPin, Pencil, Phone, UserPlus, Wrench } from "lucide-react";
import { useCurrentUser } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { useAppData } from "@/hooks/useAppData";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, PageSkeleton, EmptyState } from "@/components/common/States";
import { EmployeeStatusBadge, InstrumentStatusBadge, ProjectStatusBadge } from "@/components/common/StatusBadges";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, Progress } from "@/components/ui/misc";
import { EmployeeFormDialog } from "@/features/employees/EmployeeFormDialog";
import { AssignEngineerDialog } from "@/features/projects/AssignEngineerDialog";
import { ExpenseTable } from "@/features/expenses/ExpenseTable";
import { availabilityOf, engineerLoad } from "@/features/employees/availability";
import { MAN_DAY_WEIGHT } from "@/domain/assumptions";
import { addDays, todayISO } from "@/lib/dates";
import { formatDate, formatINR, formatNumber, formatPct } from "@/lib/format";
import { cn, sum } from "@/lib/utils";
import { NotFoundPage } from "./StatusPages";

export function EngineerDetailPage() {
  const { id = "" } = useParams();
  const { user } = useCurrentUser();
  const data = useAppData();
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  if (data.isLoading) return <PageSkeleton />;
  if (data.error) return <ErrorState error={data.error} />;
  const emp = data.employeeById.get(id);
  if (!emp) return <NotFoundPage />;

  const assignments = data.assignments.filter((a) => a.employeeId === id).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const { open, allocation } = engineerLoad(id, data.assignments);
  const expenses = data.expenses.filter((e) => e.employeeId === id);
  const instruments = data.instruments.filter((i) => i.assignedEngineerId === id);
  const avail = availabilityOf(emp, allocation);
  const showRates = can(user.role, "rates.view");
  // Man-day usage per project, from the same engine as the project pages
  const usage = data.projects
    .map((p) => ({ p, u: data.perf.get(p.id)?.byEmployee.find((x) => x.employeeId === id) }))
    .filter((x): x is { p: (typeof data.projects)[number]; u: NonNullable<typeof x.u> } => !!x.u)
    .sort((a, b) => b.p.startDate.localeCompare(a.p.startDate));
  const since30 = addDays(todayISO(), -30);
  const md30 = data.dailyLogs
    .filter((l) => l.date >= since30)
    .reduce((acc, l) => acc + l.attendance.filter((a) => a.employeeId === id).reduce((x, a) => x + MAN_DAY_WEIGHT[a.status], 0), 0);
  const idleAll = usage.reduce((acc, x) => acc + x.u.idleManDays, 0);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Site Engineers", to: "/engineers" }, { label: emp.name }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={emp.name} className="size-11 text-sm" />
            <span>
              {emp.name}
              <span className="block text-sm font-normal text-muted-foreground">{emp.designation} · {emp.code}</span>
            </span>
          </span>
        }
        actions={
          <>
            {can(user.role, "project.assign") && (
              <Button variant="outline" onClick={() => setAssignOpen(true)} disabled={emp.status === "inactive"}>
                <UserPlus /> Assign to project
              </Button>
            )}
            {can(user.role, "engineer.manage") && (
              <Button onClick={() => setEditOpen(true)}>
                <Pencil /> Edit
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <EmployeeStatusBadge status={emp.status} />
        <Badge tone={avail.tone}>{avail.label}</Badge>
        <span className="flex items-center gap-1.5"><Mail className="size-4" /> {emp.email}</span>
        <span className="flex items-center gap-1.5"><Phone className="size-4" /> {emp.phone}</span>
        <span className="flex items-center gap-1.5"><MapPin className="size-4" /> {emp.baseLocation}</span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Current allocation" value={`${allocation}%`} hint={<Progress value={Math.min(allocation, 100)} className="mt-1" />} />
        <StatCard label="Man-days (last 30 days)" value={`${formatNumber(md30, 1)} MD`} hint={`${formatNumber(idleAll, 1)} idle MD across all projects`} />
        <StatCard label="Approved expenses" value={formatINR(sum(expenses.filter((e) => e.status === "approved"), (e) => e.amount))} hint={`${expenses.filter((e) => e.status === "pending").length} pending`} />
        {showRates ? <StatCard label="Daily cost" value={`${formatINR(emp.dailyCost)} / day`} hint="Internal costing rate used for wages" /> : <StatCard label="Instruments issued" value={instruments.length} />}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Current assignments</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {open.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Not assigned to any project.</p>
            ) : (
              open.map((a) => {
                const p = data.projectById.get(a.projectId)!;
                return (
                  <Link key={a.id} to={`/projects/${p.id}?tab=team`} className="flex flex-wrap items-center gap-4 rounded-md border p-3 hover:bg-muted/50">
                    <div className="min-w-48 flex-1">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.site} · since {formatDate(a.startDate)}</p>
                    </div>
                    <Badge tone="info">{a.role}</Badge>
                    <Badge>{a.allocation}%</Badge>
                    <div className="flex w-32 items-center gap-2"><Progress value={(data.perf.get(p.id)?.progress ?? 0) * 100} /><span className="text-xs">{formatPct((data.perf.get(p.id)?.progress ?? 0) * 100, 0)}</span></div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="size-4" /> Instruments assigned</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {instruments.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No instruments issued.</p>
            ) : (
              instruments.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5">
                  <div>
                    <p className="text-sm font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.code} · {data.projectById.get(i.assignedProjectId ?? "")?.name}</p>
                  </div>
                  <InstrumentStatusBadge status={i.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Project history & man-days</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">From daily work logs{showRates ? ` · wages at ${formatINR(emp.dailyCost)}/day` : ""}</p>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {usage.length === 0 ? (
            <EmptyState title="No man-days logged yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-5 py-2 text-left font-medium">Project</th>
                    <th className="px-3 py-2 text-left font-medium">Role</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Days</th>
                    <th className="px-3 py-2 text-right font-medium">Man-days</th>
                    <th className="px-3 py-2 text-right font-medium">Idle MD</th>
                    {showRates && <th className="px-5 py-2 text-right font-medium">Wages</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {usage.map(({ p, u }) => {
                    const asg = assignments.find((a) => a.projectId === p.id);
                    return (
                      <tr key={p.id}>
                        <td className="px-5 py-2.5"><Link to={`/projects/${p.id}?tab=log`} className="font-medium hover:text-primary hover:underline">{p.name}</Link></td>
                        <td className="px-3 py-2.5">{asg?.role ?? "—"}{asg && !asg.endDate && <Badge tone="info" className="ml-2">Current</Badge>}</td>
                        <td className="px-3 py-2.5"><ProjectStatusBadge status={p.status} /></td>
                        <td className="px-3 py-2.5 text-right tabular">{u.days}</td>
                        <td className="px-3 py-2.5 text-right font-medium tabular">{formatNumber(u.manDays, 1)}</td>
                        <td className={cn("px-3 py-2.5 text-right tabular", u.idleManDays > 0 && "text-warning")}>{formatNumber(u.idleManDays, 1)}</td>
                        {showRates && <td className="px-5 py-2.5 text-right tabular">{formatINR(u.wages)}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold">Expense history</h2>
        <ExpenseTable expenses={expenses} hideEmployee />
      </div>

      <EmployeeFormDialog open={editOpen} onOpenChange={setEditOpen} employee={emp} />
      <AssignEngineerDialog open={assignOpen} onOpenChange={setAssignOpen} employeeId={emp.id} />
    </div>
  );
}
