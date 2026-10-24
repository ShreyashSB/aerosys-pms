import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, HardHat, MoreHorizontal, Pencil, Plus, UserPlus } from "lucide-react";
import { useCurrentUser } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { useAppData } from "@/hooks/useAppData";
import { useUrlState } from "@/hooks/useUrlState";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { FilterBar, SearchInput } from "@/components/common/FilterBar";
import { EmptyState, ErrorState } from "@/components/common/States";
import { EmployeeStatusBadge } from "@/components/common/StatusBadges";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { EmployeeFormDialog } from "@/features/employees/EmployeeFormDialog";
import { AssignEngineerDialog } from "@/features/projects/AssignEngineerDialog";
import { availabilityOf, engineerLoad } from "@/features/employees/availability";
import { formatINR } from "@/lib/format";
import { includesText } from "@/lib/utils";
import type { Employee } from "@/types/models";

export function EngineersPage() {
  const { user } = useCurrentUser();
  const data = useAppData();
  const navigate = useNavigate();
  const filters = useUrlState(["q", "availability", "project"] as const);
  const { q, availability, project } = filters.values;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | undefined>();
  const [assigning, setAssigning] = useState<Employee | null>(null);
  const canManage = can(user.role, "engineer.manage");
  const canAssign = can(user.role, "project.assign");
  const showRates = can(user.role, "rates.view");

  const rows = useMemo(() => {
    return data.employees
      .filter((e) => e.isSiteEngineer)
      .map((e) => {
        const { open, allocation } = engineerLoad(e.id, data.assignments);
        const primary = [...open].sort((a, b) => b.allocation - a.allocation)[0];
        return { e, open, allocation, primary, avail: availabilityOf(e, allocation) };
      })
      .filter(
        (r) =>
          includesText([r.e.name, r.e.code, r.e.designation], q) &&
          (!availability || r.avail.key === availability) &&
          (!project || r.open.some((a) => a.projectId === project)),
      );
  }, [data.employees, data.assignments, q, availability, project]);

  type Row = (typeof rows)[number];
  const all = data.employees.filter((e) => e.isSiteEngineer);
  const deployed = all.filter((e) => engineerLoad(e.id, data.assignments).allocation > 0).length;

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (r) => r.e.name,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.e.name} />
          <div>
            <p className="font-medium">{r.e.name}</p>
            <p className="text-xs text-muted-foreground">{r.e.designation}</p>
          </div>
        </div>
      ),
    },
    { key: "code", header: "Employee ID", sortValue: (r) => r.e.code, cell: (r) => <span className="text-muted-foreground">{r.e.code}</span>, hideOnMobile: true },
    ...(showRates ? [{ key: "rate", header: "Daily cost", align: "right" as const, sortValue: (r: Row) => r.e.dailyCost, cell: (r: Row) => <span className="tabular">{formatINR(r.e.dailyCost)}</span>, hideOnMobile: true }] : []),
    {
      key: "project",
      header: "Current project",
      sortValue: (r) => (r.primary ? data.projectById.get(r.primary.projectId)?.name ?? "" : "~"),
      cell: (r) =>
        r.primary ? (
          <div>
            <Link to={`/projects/${r.primary.projectId}`} className="hover:text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
              {data.projectById.get(r.primary.projectId)?.name}
            </Link>
            {r.open.length > 1 && <span className="ml-1 text-xs text-muted-foreground">+{r.open.length - 1} more</span>}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { key: "site", header: "Site", hideOnMobile: true, cell: (r) => <span className="text-muted-foreground">{r.primary ? data.projectById.get(r.primary.projectId)?.site : r.e.baseLocation}</span> },
    { key: "availability", header: "Availability", sortValue: (r) => r.allocation, cell: (r) => <Badge tone={r.avail.tone}>{r.avail.label}</Badge> },
    { key: "status", header: "Status", sortValue: (r) => r.e.status, cell: (r) => <EmployeeStatusBadge status={r.e.status} /> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.e.name}`}><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => navigate(`/engineers/${r.e.id}`)}><Eye /> View engineer</DropdownMenuItem>
              {canAssign && <DropdownMenuItem onSelect={() => setAssigning(r.e)} disabled={r.e.status === "inactive"}><UserPlus /> Assign to project</DropdownMenuItem>}
              {canManage && <DropdownMenuItem onSelect={() => { setEditing(r.e); setFormOpen(true); }}><Pencil /> Edit</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  if (data.error) return <ErrorState error={data.error} />;
  const openProjects = data.projects.filter((p) => p.status === "active" || p.status === "on_hold" || p.status === "planning");

  return (
    <div>
      <PageHeader
        title="Site Engineers"
        description="Deployment, availability and assignments of field engineers and technicians."
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Site Engineers" }]}
        actions={canManage && <Button onClick={() => { setEditing(undefined); setFormOpen(true); }}><Plus /> Add engineer</Button>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Engineers & technicians" value={all.length} loading={data.isLoading} />
        <StatCard label="Deployed" value={deployed} loading={data.isLoading} />
        <StatCard label="Available" value={all.filter((e) => e.status === "active" && engineerLoad(e.id, data.assignments).allocation === 0).length} loading={data.isLoading} />
        <StatCard label="On leave" value={all.filter((e) => e.status === "on_leave").length} loading={data.isLoading} />
      </div>
      <FilterBar onReset={filters.reset} showReset={filters.active}>
        <SearchInput value={q} onChange={(v) => filters.set("q", v)} placeholder="Search name, ID, designation…" />
        <Select value={availability} onChange={(e) => filters.set("availability", e.target.value)} className="w-auto" aria-label="Filter by availability">
          <option value="">All availability</option>
          <option value="available">Available</option>
          <option value="partial">Partially free</option>
          <option value="deployed">Fully deployed</option>
          <option value="on_leave">On leave</option>
        </Select>
        <Select value={project} onChange={(e) => filters.set("project", e.target.value)} className="w-auto max-w-64" aria-label="Filter by project">
          <option value="">All projects</option>
          {openProjects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </Select>
      </FilterBar>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.e.id}
        loading={data.isLoading}
        onRowClick={(r) => navigate(`/engineers/${r.e.id}`)}
        initialSort={{ key: "name", dir: "asc" }}
        empty={<EmptyState icon={<HardHat />} title="No engineers found" description="Try changing the filters." />}
      />
      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} employee={editing} defaults={{ isSiteEngineer: true, department: "Engineering", appRole: "site_engineer" }} />
      <AssignEngineerDialog open={!!assigning} onOpenChange={(o) => !o && setAssigning(null)} employeeId={assigning?.id} />
    </div>
  );
}
