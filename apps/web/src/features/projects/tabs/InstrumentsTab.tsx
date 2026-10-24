import { useState } from "react";
import { toast } from "sonner";
import { Undo2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/common/DataTable";
import { EmptyState } from "@/components/common/States";
import { InstrumentStatusBadge } from "@/components/common/StatusBadges";
import { AssignInstrumentDialog } from "@/features/instruments/InstrumentDialogs";
import { useReturnInstrument } from "@/hooks/mutations";
import { instrumentCharge } from "@/domain/assumptions";
import { daysBetween, minDate, todayISO } from "@/lib/dates";
import { formatDate, formatINR } from "@/lib/format";
import type { AppSettings, Employee, Instrument, Project, ProjectInstrument } from "@/types/models";

export function InstrumentsTab({
  project,
  instruments,
  deployments,
  employeeById,
  instrumentById,
  canManage,
  showCost,
  settings,
}: {
  project: Project;
  instruments: Instrument[];
  deployments: ProjectInstrument[];
  employeeById: Map<string, Employee>;
  instrumentById: Map<string, Instrument>;
  canManage: boolean;
  showCost: boolean;
  settings: AppSettings;
}) {
  const monthlyRatePct = settings.instrumentMonthlyRatePct;
  const chargeFor = (d: ProjectInstrument, value: number) => {
    const end = minDate(d.returnedAt ?? todayISO(), todayISO());
    return end < d.assignedAt ? 0 : instrumentCharge(value, daysBetween(d.assignedAt, end) + 1, settings);
  };
  const [picking, setPicking] = useState(false);
  const [assigning, setAssigning] = useState<Instrument | null>(null);
  const ret = useReturnInstrument();
  const current = instruments.filter((i) => i.assignedProjectId === project.id);
  const available = instruments.filter((i) => i.status === "available");
  const history = deployments.filter((d) => d.projectId === project.id).sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{current.length} instruments currently on site</p>
        {canManage && (
          <Button onClick={() => setPicking((p) => !p)} variant={picking ? "outline" : "default"} disabled={project.status === "completed" || project.status === "archived"}>
            <Wrench /> {picking ? "Close" : "Assign instrument"}
          </Button>
        )}
      </div>

      {picking && (
        <Card className="p-4">
          <p className="mb-3 text-sm font-medium">Available instruments ({available.length})</p>
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">No instruments are available right now.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {available.map((i) => (
                <button key={i.id} onClick={() => setAssigning(i)} className="rounded-md border p-3 text-left hover:border-primary hover:bg-primary-soft/40 cursor-pointer">
                  <p className="text-sm font-medium">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{i.code} · {i.category}</p>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      <DataTable
        rows={current}
        rowKey={(i) => i.id}
        columns={[
          { key: "name", header: "Instrument", cell: (i) => <><p className="font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{i.code} · SN {i.serialNumber}</p></>, sortValue: (i) => i.name },
          { key: "cat", header: "Category", cell: (i) => i.category, hideOnMobile: true },
          { key: "eng", header: "With engineer", cell: (i) => employeeById.get(i.assignedEngineerId ?? "")?.name ?? "—" },
          { key: "status", header: "Status", cell: (i) => <InstrumentStatusBadge status={i.status} /> },
          {
            key: "act",
            header: <span className="sr-only">Actions</span>,
            align: "right",
            cell: (i) =>
              canManage && (
                <Button size="sm" variant="outline" loading={ret.isPending && ret.variables === i.id} onClick={() => ret.mutate(i.id, { onSuccess: () => toast.success(`${i.name} returned to store`) })}>
                  <Undo2 /> Return
                </Button>
              ),
          },
        ]}
        empty={<EmptyState icon={<Wrench />} title="No instruments on this project" />}
      />

      {history.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Deployment history {showCost && <span className="font-normal text-muted-foreground">· usage charged at {monthlyRatePct}% of value / month</span>}</h3>
          <Card className="divide-y">
            {history.map((d) => {
              const ins = instrumentById.get(d.instrumentId);
              return (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span>
                    {ins?.name} <span className="text-muted-foreground">· {employeeById.get(d.engineerId ?? "")?.name ?? "—"}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(d.assignedAt)} – {d.returnedAt ? formatDate(d.returnedAt) : "present"}
                    {showCost && ins && ` · ${formatINR(chargeFor(d, ins.purchaseValue))}`}
                  </span>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      <AssignInstrumentDialog open={!!assigning} onOpenChange={(o) => { if (!o) { setAssigning(null); setPicking(false); } }} instrument={assigning} defaultProjectId={project.id} />
    </div>
  );
}
