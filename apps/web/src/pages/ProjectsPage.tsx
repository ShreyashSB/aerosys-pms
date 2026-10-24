import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Archive, Eye, FolderKanban, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useCurrentUser } from "@/auth/AuthContext";
import { can, canManageProject } from "@/auth/permissions";
import { useScopedData } from "@/hooks/useAppData";
import { useUrlState } from "@/hooks/useUrlState";
import { useDeleteProject, useSetProjectStatus } from "@/hooks/mutations";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { FilterBar, SearchInput } from "@/components/common/FilterBar";
import { EmptyState, ErrorState } from "@/components/common/States";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PROJECT_STATUS, ProjectStatusBadge } from "@/components/common/StatusBadges";
import { Money } from "@/components/common/Money";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/misc";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { ProjectFormDialog } from "@/features/projects/ProjectFormDialog";
import { cn, includesText } from "@/lib/utils";
import { formatINRShort, formatPct, formatPerMd } from "@/lib/format";
import { runningPpiHealth, TONE_CLASSES } from "@/domain/health";
import { HealthBadge } from "@/components/common/Health";
import type { Project, ProjectStatus } from "@/types/models";

export function ProjectsPage() {
  const { user } = useCurrentUser();
  const data = useScopedData();
  const navigate = useNavigate();
  const filters = useUrlState(["q", "status", "manager", "client"] as const);
  const { q, status, manager, client } = filters.values;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | undefined>();
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [archiving, setArchiving] = useState<Project | null>(null);
  const remove = useDeleteProject();
  const setStatus = useSetProjectStatus();
  const showFinance = can(user.role, "finance.view");

  const projects = data.scopedProjects;
  const managers = useMemo(() => [...new Set(projects.map((p) => p.managerId))].map((id) => data.employeeById.get(id)!).filter(Boolean), [projects, data.employeeById]);
  const clients = useMemo(() => [...new Set(projects.map((p) => p.clientName))].sort(), [projects]);

  const rows = useMemo(
    () =>
      projects.filter(
        (p) =>
          (status ? p.status === status : p.status !== "archived") &&
          (!manager || p.managerId === manager) &&
          (!client || p.clientName === client) &&
          includesText([p.name, p.clientName, p.site, p.code], q),
      ),
    [projects, status, manager, client, q],
  );

  const columns: Column<Project>[] = [
    {
      key: "name",
      header: "Project",
      sortValue: (p) => p.name,
      cell: (p) => (
        <div className="min-w-48">
          <p className="font-medium text-foreground">{p.name}</p>
          <p className="text-xs text-muted-foreground">{p.code}</p>
        </div>
      ),
    },
    { key: "client", header: "Client", sortValue: (p) => p.clientName, cell: (p) => p.clientName, hideOnMobile: true },
    { key: "site", header: "Site", sortValue: (p) => p.site, cell: (p) => <span className="text-muted-foreground">{p.site}</span>, className: "hidden 2xl:table-cell" },
    { key: "manager", header: "Manager", sortValue: (p) => data.employeeById.get(p.managerId)?.name ?? "", cell: (p) => data.employeeById.get(p.managerId)?.name ?? "—", hideOnMobile: true },
    ...(showFinance
      ? [
          { key: "value", header: "Value", align: "right" as const, sortValue: (p: Project) => p.contractValue, cell: (p: Project) => <Money value={p.contractValue} /> },
          { key: "cost", header: "Cost", align: "right" as const, sortValue: (p: Project) => data.perf.get(p.id)?.costs.total ?? 0, cell: (p: Project) => <Money value={data.perf.get(p.id)?.costs.total ?? 0} /> },
          {
            key: "rppi",
            header: "Running PPI",
            align: "right" as const,
            hideOnMobile: true,
            sortValue: (p: Project) => data.perf.get(p.id)?.ppiVariancePct ?? 0,
            cell: (p: Project) => {
              const f = data.perf.get(p.id);
              if (!f || !f.consumedManDays) return <span className="text-muted-foreground">—</span>;
              const h = runningPpiHealth(f);
              return (
                <span className={cn("tabular", TONE_CLASSES[h.tone].text)} title={`${h.label} · baseline ${formatPerMd(f.ppi)}`}>
                  {formatINRShort(f.runningPpi)}
                  <span className="block text-[11px]">{f.ppiVariancePct >= 0 ? "+" : ""}{formatPct(f.ppiVariancePct, 0)}</span>
                </span>
              );
            },
          },
        ]
      : []),
    {
      key: "completion",
      header: "Progress",
      sortValue: (p) => data.perf.get(p.id)?.progress ?? 0,
      cell: (p) => {
        const pr = (data.perf.get(p.id)?.progress ?? 0) * 100;
        return (
          <div className="flex w-28 items-center gap-2">
            <Progress value={pr} tone={pr >= 100 ? "success" : "primary"} />
            <span className="w-9 text-right text-xs tabular">{formatPct(pr, 0)}</span>
          </div>
        );
      },
    },
    { key: "health", header: "Health", sortValue: (p) => data.health.get(p.id)?.tone ?? "", cell: (p) => { const h = data.health.get(p.id); return h ? <HealthBadge health={h} /> : null; } },
    { key: "status", header: "Status", sortValue: (p) => p.status, cell: (p) => <ProjectStatusBadge status={p.status} /> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (p) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => navigate(`/projects/${p.id}`)}>
                <Eye /> View project
              </DropdownMenuItem>
              {can(user.role, "project.edit") && canManageProject(user, p) && (
                <DropdownMenuItem onSelect={() => { setEditing(p); setFormOpen(true); }}>
                  <Pencil /> Edit
                </DropdownMenuItem>
              )}
              {can(user.role, "project.delete") && (
                <>
                  <DropdownMenuSeparator />
                  {p.status !== "archived" ? (
                    <DropdownMenuItem onSelect={() => setArchiving(p)}>
                      <Archive /> Archive
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => setStatus.mutate({ id: p.id, status: "completed" }, { onSuccess: () => toast.success("Project restored") })}>
                      <Archive /> Restore
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem destructive onSelect={() => setDeleting(p)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  if (data.error) return <ErrorState error={data.error} />;

  return (
    <div>
      <PageHeader
        title={user.role === "management" || user.role === "accounts" ? "Projects" : "My Projects"}
        description={`${rows.length} of ${projects.filter((p) => p.status !== "archived").length} projects`}
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Projects" }]}
        actions={
          can(user.role, "project.create") && (
            <Button onClick={() => { setEditing(undefined); setFormOpen(true); }}>
              <Plus /> Create project
            </Button>
          )
        }
      />

      <FilterBar onReset={filters.reset} showReset={filters.active}>
        <SearchInput value={q} onChange={(v) => filters.set("q", v)} placeholder="Search project, client, site…" />
        <Select value={status} onChange={(e) => filters.set("status", e.target.value)} className="w-auto min-w-36" aria-label="Filter by status">
          <option value="">All statuses</option>
          {(Object.keys(PROJECT_STATUS) as ProjectStatus[]).map((s) => (
            <option key={s} value={s}>{PROJECT_STATUS[s].label}</option>
          ))}
        </Select>
        {user.role !== "project_manager" && (
          <Select value={manager} onChange={(e) => filters.set("manager", e.target.value)} className="w-auto min-w-40" aria-label="Filter by manager">
            <option value="">All managers</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        )}
        <Select value={client} onChange={(e) => filters.set("client", e.target.value)} className="w-auto min-w-40 max-w-60" aria-label="Filter by client">
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </FilterBar>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(p) => p.id}
        loading={data.isLoading}
        onRowClick={(p) => navigate(`/projects/${p.id}`)}
        initialSort={{ key: "name", dir: "asc" }}
        empty={
          <EmptyState
            icon={<FolderKanban />}
            title={filters.active ? "No projects match your filters" : "No projects yet"}
            description={filters.active ? "Try adjusting the search or filters." : user.role === "site_engineer" ? "You are not assigned to any project yet." : "Create your first project to get started."}
            action={filters.active ? <Button variant="outline" onClick={filters.reset}>Clear filters</Button> : undefined}
          />
        }
      />

      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} project={editing} />
      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(o) => !o && setArchiving(null)}
        title="Archive project?"
        description={<>“{archiving?.name}” will be hidden from lists and dashboards. Its records are kept and it can be restored from the Archived filter.</>}
        confirmLabel="Archive"
        loading={setStatus.isPending}
        onConfirm={() => archiving && setStatus.mutate({ id: archiving.id, status: "archived" }, { onSuccess: () => { toast.success("Project archived"); setArchiving(null); } })}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete project permanently?"
        description={<>This removes “{deleting?.name}” together with its assignments, expenses and cost entries, and returns its instruments to the store. This cannot be undone.</>}
        confirmLabel="Delete project"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => { toast.success("Project deleted"); setDeleting(null); } })}
      />
    </div>
  );
}
