import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Ban, MoreHorizontal, Pencil, Plus, Send, Undo2, Wrench, CheckCircle2, Hammer, FileCheck2 } from "lucide-react";
import { useCurrentUser } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { useScopedData } from "@/hooks/useAppData";
import { useUrlState } from "@/hooks/useUrlState";
import { useReturnInstrument, useSetInstrumentStatus } from "@/hooks/mutations";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { FilterBar, SearchInput } from "@/components/common/FilterBar";
import { EmptyState, ErrorState } from "@/components/common/States";
import { StatCard } from "@/components/common/StatCard";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { INSTRUMENT_STATUS, InstrumentStatusBadge } from "@/components/common/StatusBadges";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { AssignInstrumentDialog, INSTRUMENT_CATEGORIES, InstrumentFormDialog } from "@/features/instruments/InstrumentDialogs";
import { instrumentPerDayValue } from "@/domain/assumptions";
import { addDays, todayISO } from "@/lib/dates";
import { formatDate, formatINR, formatINRShort } from "@/lib/format";
import { includesText, sum } from "@/lib/utils";
import type { Instrument, InstrumentStatus } from "@/types/models";

export function InstrumentsPage() {
  const { user } = useCurrentUser();
  const data = useScopedData();
  const filters = useUrlState(["q", "status", "category", "project"] as const);
  const f = filters.values;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Instrument | undefined>();
  const [assigning, setAssigning] = useState<Instrument | null>(null);
  const [statusChange, setStatusChange] = useState<{ ins: Instrument; status: "maintenance" | "retired" | "available" } | null>(null);
  const ret = useReturnInstrument();
  const setStatus = useSetInstrumentStatus();
  const manage = can(user.role, "instrument.manage");
  const isEngineer = user.role === "site_engineer";

  const base = data.scopedInstruments;
  const rows = useMemo(
    () =>
      base.filter(
        (i) =>
          (!f.status || i.status === f.status) &&
          (!f.category || i.category === f.category) &&
          (!f.project || i.assignedProjectId === f.project) &&
          includesText([i.name, i.code, i.serialNumber, data.employeeById.get(i.assignedEngineerId ?? "")?.name], f.q),
      ),
    [base, f, data.employeeById],
  );

  // On a project the instrument is at that project's site; otherwise wherever it is stored.
  const locationOf = (i: Instrument) => (i.assignedProjectId ? data.projectById.get(i.assignedProjectId)?.site ?? "Project site" : i.currentLocation);

  const columns: Column<Instrument>[] = [
    {
      key: "name",
      header: "Instrument",
      sortValue: (i) => i.name,
      cell: (i) => (
        <div className="min-w-44">
          <p className="font-medium">{i.name}</p>
          <p className="text-xs text-muted-foreground">
            {i.code} · SN <span className="font-mono">{i.serialNumber}</span>
          </p>
          {i.calibration && <CalibrationLine validUntil={i.calibration.validUntil} />}
        </div>
      ),
    },
    { key: "category", header: "Category", sortValue: (i) => i.category, cell: (i) => i.category, hideOnMobile: true, className: "whitespace-nowrap" },
    ...(can(user.role, "finance.view") || manage
      ? [
          {
            key: "value",
            header: "Asset value",
            align: "right" as const,
            sortValue: (i: Instrument) => i.assetValue,
            hideOnMobile: true,
            cell: (i: Instrument) => (
              <div className="tabular">
                <p>{formatINR(i.assetValue)}</p>
                <p className="text-xs text-muted-foreground">{formatINR(instrumentPerDayValue(i))} / day</p>
              </div>
            ),
          },
        ]
      : []),
    { key: "status", header: "Status", sortValue: (i) => i.status, cell: (i) => <InstrumentStatusBadge status={i.status} /> },
    { key: "engineer", header: "Assigned engineer", sortValue: (i) => data.employeeById.get(i.assignedEngineerId ?? "")?.name ?? "~", cell: (i) => data.employeeById.get(i.assignedEngineerId ?? "")?.name ?? <span className="text-muted-foreground">—</span> },
    {
      key: "project",
      header: "Assigned project",
      sortValue: (i) => data.projectById.get(i.assignedProjectId ?? "")?.name ?? "~",
      cell: (i) =>
        i.assignedProjectId ? (
          <Link to={`/projects/${i.assignedProjectId}?tab=instruments`} className="hover:text-primary hover:underline">{data.projectById.get(i.assignedProjectId)?.name}</Link>
        ) : (
          <span className="text-muted-foreground">{i.notes || "—"}</span>
        ),
    },
    {
      key: "location",
      header: "Location",
      sortValue: (i) => locationOf(i),
      hideOnMobile: true,
      cell: (i) => (i.assignedProjectId ? <span>{locationOf(i)}</span> : <span className="text-muted-foreground">{locationOf(i)}</span>),
    },
    ...(manage
      ? [
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            align: "right" as const,
            className: "whitespace-nowrap",
            cell: (i: Instrument) => (
              <div className="flex items-center justify-end gap-1">
                {i.status === "available" && (
                  <Button size="sm" variant="outline" onClick={() => setAssigning(i)}><Send /> Assign</Button>
                )}
                {i.status === "assigned" && (
                  <Button size="sm" variant="outline" loading={ret.isPending && ret.variables === i.id} onClick={() => ret.mutate(i.id, { onSuccess: () => toast.success(`${i.name} returned to store`) })}>
                    <Undo2 /> Return
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${i.name}`}><MoreHorizontal /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => { setEditing(i); setFormOpen(true); }}><Pencil /> Edit details</DropdownMenuItem>
                    {i.status === "assigned" && <DropdownMenuItem onSelect={() => setAssigning(i)}><Send /> Reassign</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    {i.status !== "available" && i.status !== "assigned" && (
                      <DropdownMenuItem onSelect={() => setStatusChange({ ins: i, status: "available" })}><CheckCircle2 /> Mark available</DropdownMenuItem>
                    )}
                    {i.status !== "maintenance" && i.status !== "retired" && (
                      <DropdownMenuItem onSelect={() => setStatusChange({ ins: i, status: "maintenance" })}><Hammer /> Send for maintenance</DropdownMenuItem>
                    )}
                    {i.status !== "retired" && (
                      <DropdownMenuItem destructive onSelect={() => setStatusChange({ ins: i, status: "retired" })}><Ban /> Retire</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ),
          },
        ]
      : []),
  ];

  if (data.error) return <ErrorState error={data.error} />;
  const count = (s: InstrumentStatus) => base.filter((i) => i.status === s).length;
  const statusCopy = {
    available: { title: "Mark instrument available?", label: "Mark available", desc: "The instrument will be returned to the store and can be assigned again." },
    maintenance: { title: "Send for maintenance?", label: "Send for maintenance", desc: "The instrument will be recalled from any project and marked under maintenance / calibration." },
    retired: { title: "Retire instrument?", label: "Retire", desc: "Retired instruments cannot be assigned. Any active deployment will be closed." },
  } as const;

  return (
    <div>
      <PageHeader
        title={isEngineer ? "My Instruments" : "Instruments & Equipment"}
        description={isEngineer ? "Instruments currently issued to you." : "Track testing instruments and tools across sites."}
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Instruments" }]}
        actions={manage && <Button onClick={() => { setEditing(undefined); setFormOpen(true); }}><Plus /> Add instrument</Button>}
      />
      {!isEngineer && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard label="Total instruments" value={base.length} loading={data.isLoading} hint={`${formatINRShort(sum(base, (i) => i.assetValue))} asset value`} />
          <StatCard label="Available" value={count("available")} loading={data.isLoading} />
          <StatCard label="Assigned" value={count("assigned")} loading={data.isLoading} />
          <StatCard label="Maintenance" value={count("maintenance")} loading={data.isLoading} />
          <StatCard label="Retired" value={count("retired")} loading={data.isLoading} />
        </div>
      )}
      <FilterBar onReset={filters.reset} showReset={filters.active}>
        <SearchInput value={f.q} onChange={(v) => filters.set("q", v)} placeholder="Search name, ID, serial, engineer…" />
        <Select value={f.status} onChange={(e) => filters.set("status", e.target.value)} className="w-auto" aria-label="Filter by status">
          <option value="">All statuses</option>
          {(Object.keys(INSTRUMENT_STATUS) as InstrumentStatus[]).map((s) => (<option key={s} value={s}>{INSTRUMENT_STATUS[s].label}</option>))}
        </Select>
        <Select value={f.category} onChange={(e) => filters.set("category", e.target.value)} className="w-auto" aria-label="Filter by category">
          <option value="">All categories</option>
          {INSTRUMENT_CATEGORIES.map((c) => (<option key={c}>{c}</option>))}
        </Select>
        {!isEngineer && (
          <Select value={f.project} onChange={(e) => filters.set("project", e.target.value)} className="w-auto max-w-56" aria-label="Filter by project">
            <option value="">All projects</option>
            {data.scopedProjects.filter((p) => p.status === "active" || p.status === "on_hold").map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </Select>
        )}
      </FilterBar>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(i) => i.id}
        loading={data.isLoading}
        initialSort={{ key: "name", dir: "asc" }}
        empty={<EmptyState icon={<Wrench />} title={isEngineer ? "No instruments issued to you" : "No instruments found"} description={filters.active ? "Try changing the filters." : undefined} />}
      />
      <InstrumentFormDialog open={formOpen} onOpenChange={setFormOpen} instrument={editing} />
      <AssignInstrumentDialog open={!!assigning} onOpenChange={(o) => !o && setAssigning(null)} instrument={assigning} />
      <ConfirmDialog
        open={!!statusChange}
        onOpenChange={(o) => !o && setStatusChange(null)}
        title={statusChange ? statusCopy[statusChange.status].title : ""}
        description={statusChange && <><strong>{statusChange.ins.name}</strong> ({statusChange.ins.code}). {statusCopy[statusChange.status].desc}</>}
        confirmLabel={statusChange ? statusCopy[statusChange.status].label : ""}
        destructive={statusChange?.status === "retired"}
        noteLabel={statusChange?.status === "available" ? undefined : "Note (optional)"}
        loading={setStatus.isPending}
        onConfirm={(note) =>
          statusChange &&
          setStatus.mutate(
            { id: statusChange.ins.id, status: statusChange.status, notes: statusChange.status === "available" ? "" : note || undefined },
            { onSuccess: () => { toast.success(`${statusChange.ins.name}: ${INSTRUMENT_STATUS[statusChange.status].label}`); setStatusChange(null); } },
          )
        }
      />
    </div>
  );
}

/** "Calibrated · valid till 12 Mar 2027", amber when it expires within 30 days, red once expired. */
function CalibrationLine({ validUntil }: { validUntil: string | null }) {
  const today = todayISO();
  const tone = !validUntil ? "text-muted-foreground" : validUntil < today ? "text-danger" : validUntil <= addDays(today, 30) ? "text-warning" : "text-success";
  const text = !validUntil ? "Calibration certificate on file" : validUntil < today ? `Calibration expired ${formatDate(validUntil)}` : `Calibrated · valid till ${formatDate(validUntil)}`;
  return (
    <p className={`mt-0.5 flex items-center gap-1 text-xs ${tone}`}>
      <FileCheck2 className="size-3" /> {text}
    </p>
  );
}
