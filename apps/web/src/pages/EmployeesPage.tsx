import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Pencil, Plus, Users } from "lucide-react";
import { useCurrentUser, useAuth } from "@/auth/AuthContext";
import { can, ROLE_LABELS } from "@/auth/permissions";
import { useAppData } from "@/hooks/useAppData";
import { useUrlState } from "@/hooks/useUrlState";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { FilterBar, SearchInput } from "@/components/common/FilterBar";
import { EmptyState, ErrorState } from "@/components/common/States";
import { StatCard } from "@/components/common/StatCard";
import { EMPLOYEE_STATUS, EmployeeStatusBadge } from "@/components/common/StatusBadges";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { EmployeeFormDialog } from "@/features/employees/EmployeeFormDialog";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatDate, formatINR } from "@/lib/format";
import { todayISO } from "@/lib/dates";
import { includesText } from "@/lib/utils";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
import type { Employee, EmployeeStatus } from "@/types/models";

export function EmployeesPage() {
  const { user } = useCurrentUser();
  const { users } = useAuth();
  const data = useAppData();
  const navigate = useNavigate();
  const filters = useUrlState(["q", "department", "status"] as const);
  const f = filters.values;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | undefined>();
  const canManage = can(user.role, "employee.manage");
  const showRates = can(user.role, "rates.view");

  const departments = [...new Set(data.employees.map((e) => e.department))].sort();
  const rows = useMemo(
    () =>
      data.employees.filter(
        (e) =>
          (!f.department || e.department === f.department) &&
          (!f.status || e.status === f.status) &&
          includesText([e.name, e.code, e.designation, e.email], f.q),
      ),
    [data.employees, f],
  );
  const roleOf = (id: string) => users.find((u) => u.employeeId === id)?.role;

  const columns: Column<Employee>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (e) => e.name,
      cell: (e) => (
        <div className="flex items-center gap-3">
          <Avatar name={e.name} />
          <div>
            <p className="font-medium">{e.name}</p>
            <p className="text-xs text-muted-foreground">{e.email}</p>
          </div>
        </div>
      ),
    },
    { key: "code", header: "Employee ID", sortValue: (e) => e.code, cell: (e) => <span className="text-muted-foreground">{e.code}</span> },
    { key: "dept", header: "Department", sortValue: (e) => e.department, cell: (e) => e.department, hideOnMobile: true },
    { key: "desig", header: "Designation", sortValue: (e) => e.designation, cell: (e) => e.designation },
    ...(showRates ? [{ key: "rate", header: "Daily cost", align: "right" as const, sortValue: (e: Employee) => e.dailyCost, cell: (e: Employee) => <span className="tabular">{formatINR(e.dailyCost)}<span className="text-xs text-muted-foreground"> /day</span></span> }] : []),
    { key: "join", header: "Joining date", sortValue: (e) => e.joiningDate, cell: (e) => formatDate(e.joiningDate), hideOnMobile: true },
    { key: "access", header: "System access", hideOnMobile: true, cell: (e) => { const r = roleOf(e.id); return r ? <Badge tone="info">{ROLE_LABELS[r]}</Badge> : <span className="text-xs text-muted-foreground">—</span>; } },
    { key: "status", header: "Status", sortValue: (e) => e.status, cell: (e) => <EmployeeStatusBadge status={e.status} /> },
    ...(canManage
      ? [{
          key: "actions",
          header: <span className="sr-only">Actions</span>,
          align: "right" as const,
          cell: (e: Employee) => (
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${e.name}`} onClick={(ev) => { ev.stopPropagation(); setEditing(e); setOpen(true); }}>
              <Pencil />
            </Button>
          ),
        }]
      : []),
  ];

  const exportCsv = () =>
    downloadCsv(`aerosys-employees-${todayISO()}`, toCsv(rows, [
      { header: "Employee ID", value: (e) => e.code },
      { header: "Name", value: (e) => e.name },
      { header: "Department", value: (e) => e.department },
      { header: "Designation", value: (e) => e.designation },
      ...(showRates ? [{ header: "Daily cost (INR/day)", value: (e: Employee) => e.dailyCost }] : []),
      { header: "Joining date", value: (e) => e.joiningDate },
      { header: "Status", value: (e) => EMPLOYEE_STATUS[e.status].label },
    ]));

  if (data.error) return <ErrorState error={data.error} />;
  const active = data.employees.filter((e) => e.status !== "inactive");

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Employee directory. Each person's Daily Cost is the internal rate used to cost man-days on projects — this is not a payroll system."
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Employees" }]}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}><Download /> Export CSV</Button>
            {canManage && <Button onClick={() => { setEditing(undefined); setOpen(true); }}><Plus /> Add employee</Button>}
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Employees in system" value={data.employees.length} loading={data.isLoading} />
        <StatCard label="Active" value={active.length} loading={data.isLoading} />
        <StatCard label="Site engineers & technicians" value={data.employees.filter((e) => e.isSiteEngineer).length} loading={data.isLoading} />
        {showRates && (
          <StatCard
            label="Avg. daily cost – site staff"
            value={formatINR(avg(active.filter((e) => e.isSiteEngineer).map((e) => e.dailyCost)))}
            hint="Internal costing rate per man-day"
            loading={data.isLoading}
          />
        )}
      </div>
      <FilterBar onReset={filters.reset} showReset={filters.active}>
        <SearchInput value={f.q} onChange={(v) => filters.set("q", v)} placeholder="Search name, ID, email…" />
        <Select value={f.department} onChange={(e) => filters.set("department", e.target.value)} className="w-auto" aria-label="Filter by department">
          <option value="">All departments</option>
          {departments.map((d) => (<option key={d}>{d}</option>))}
        </Select>
        <Select value={f.status} onChange={(e) => filters.set("status", e.target.value)} className="w-auto" aria-label="Filter by status">
          <option value="">All statuses</option>
          {(Object.keys(EMPLOYEE_STATUS) as EmployeeStatus[]).map((s) => (<option key={s} value={s}>{EMPLOYEE_STATUS[s].label}</option>))}
        </Select>
      </FilterBar>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(e) => e.id}
        loading={data.isLoading}
        pageSize={12}
        initialSort={{ key: "code", dir: "asc" }}
        onRowClick={(e) => (e.isSiteEngineer && can(user.role, "engineer.view") ? navigate(`/engineers/${e.id}`) : canManage && (setEditing(e), setOpen(true)))}
        empty={<EmptyState icon={<Users />} title="No employees found" />}
      />
      <EmployeeFormDialog open={open} onOpenChange={setOpen} employee={editing} />
    </div>
  );
}
