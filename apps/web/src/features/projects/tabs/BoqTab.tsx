import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Eye, FileSpreadsheet, MoreHorizontal, Pencil, Plus, Ruler, Stamp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/common/States";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { KpiCard } from "@/components/common/KpiCard";
import { useAppData } from "@/hooks/useAppData";
import { useClosePeriod, useDeleteBoqItem } from "@/hooks/mutations";
import { boqRows, type BoqRow, type ProjectPerformance } from "@/domain/performance";
import { progressHealth } from "@/domain/health";
import { formatDate, formatINR, formatINRShort, formatNumber, formatPct } from "@/lib/format";
import { downloadCsv, toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import type { BoqItem, Project } from "@/types/models";
import { BoqItemDetail, BoqItemDialog, ExecutionDialog } from "../boq/BoqDialogs";
import type { MetricKey } from "../explainers";

export function BoqTab({
  project,
  perf: p,
  canEdit,
  showAmounts,
  onExplain,
}: {
  project: Project;
  perf: ProjectPerformance;
  canEdit: boolean;
  showAmounts: boolean;
  onExplain: (k: MetricKey) => void;
}) {
  const data = useAppData();
  const [itemDialog, setItemDialog] = useState<{ open: boolean; item: BoqItem | null }>({ open: false, item: null });
  const [executing, setExecuting] = useState<BoqRow | null>(null);
  const [viewing, setViewing] = useState<BoqRow | null>(null);
  const [deleting, setDeleting] = useState<BoqRow | null>(null);
  const [closing, setClosing] = useState(false);
  const del = useDeleteBoqItem();
  const closePeriod = useClosePeriod();

  const rows = useMemo(
    () => boqRows(data.boqItems.filter((b) => b.projectId === project.id), data.boqExecutions.filter((x) => x.projectId === project.id), project.periodStart),
    [data.boqItems, data.boqExecutions, project.id, project.periodStart],
  );
  const tot = rows.reduce(
    (a, r) => ({ contract: a.contract + r.contractAmount, prev: a.prev + r.previousAmount, curr: a.curr + r.currentAmount, bal: a.bal + r.balanceAmount }),
    { contract: 0, prev: 0, curr: 0, bal: 0 },
  );
  const mismatch = Math.abs(tot.contract - project.contractValue) > 1;
  const nextSrNo = String(rows.reduce((m, r) => Math.max(m, Number(r.item.srNo) || 0), 0) + 1);
  // keep dialogs in sync with fresh data
  const fresh = (r: BoqRow | null) => (r ? (rows.find((x) => x.item.id === r.item.id) ?? null) : null);

  const exportCsv = () =>
    downloadCsv(
      `${project.code}-annexure`,
      toCsv(rows, [
        { header: "Sr", value: (r) => r.item.srNo },
        { header: "Item description", value: (r) => r.item.description },
        { header: "UOM", value: (r) => r.item.uom },
        { header: "Contract qty", value: (r) => r.item.contractQty },
        { header: "Rate", value: (r) => r.item.rate },
        { header: "Contract amount", value: (r) => Math.round(r.contractAmount) },
        { header: "Previous qty", value: (r) => r.previousQty },
        { header: "Current qty", value: (r) => r.currentQty },
        { header: "Balance qty", value: (r) => r.balanceQty },
        { header: "Previous amount", value: (r) => Math.round(r.previousAmount) },
        { header: "Current amount", value: (r) => Math.round(r.currentAmount) },
        { header: "Balance amount", value: (r) => Math.round(r.balanceAmount) },
      ]),
    );

  const money = (n: number) => (showAmounts ? formatINR(n) : "—");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Work order (BOQ) value" value={formatINRShort(tot.contract)} sub={`${rows.length} items`} />
        <KpiCard label="Executed value" value={formatINRShort(p.executedValue)} sub="Previous + current" />
        <KpiCard label="Current period" value={formatINRShort(tot.curr)} sub={`Since ${formatDate(project.periodStart)}`} />
        <KpiCard label="Balance value" value={formatINRShort(tot.bal)} sub="Yet to execute" />
        <KpiCard label="Progress (value-weighted)" value={formatPct(p.progress * 100)} health={progressHealth(p, project)} onClick={() => onExplain("progress")} />
      </div>

      {mismatch && rows.length > 0 && (
        <p className="flex items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
          <AlertTriangle className="size-4" /> BOQ total {formatINR(tot.contract)} differs from the work order value {formatINR(project.contractValue)}. Progress uses the BOQ total.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Previous = certified up to {formatDate(project.periodStart)} · Current = executed since. Quantities come from daily logs and manual measurements.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}><FileSpreadsheet /> Export</Button>
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => setClosing(true)} disabled={!rows.length || tot.curr === 0}><Stamp /> Close measurement period</Button>
              <Button size="sm" onClick={() => setItemDialog({ open: true, item: null })}><Plus /> Add BOQ item</Button>
            </>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileSpreadsheet />}
            title="No Annexure / BOQ yet"
            description="Add the work order line items (quantity, UOM, rate). Progress, earned value and running PPI are calculated from execution against these items."
            action={canEdit ? <Button variant="outline" onClick={() => setItemDialog({ open: true, item: null })}><Plus /> Add BOQ item</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr className="border-b">
                  <th colSpan={2} className="px-3 py-1.5" />
                  <th colSpan={4} className="border-l px-3 py-1.5 text-center font-semibold uppercase tracking-wide">Contract</th>
                  <th colSpan={3} className="border-l px-3 py-1.5 text-center font-semibold uppercase tracking-wide">Quantity</th>
                  <th colSpan={3} className="border-l px-3 py-1.5 text-center font-semibold uppercase tracking-wide">Amount</th>
                  <th colSpan={2} className="border-l" />
                </tr>
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Sr</th>
                  <th className="px-3 py-2 text-left font-medium">Item description</th>
                  <th className="border-l px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-left font-medium">UOM</th>
                  <th className="px-3 py-2 text-right font-medium">Rate</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="border-l px-3 py-2 text-right font-medium">Previous</th>
                  <th className="px-3 py-2 text-right font-medium">Current</th>
                  <th className="px-3 py-2 text-right font-medium">Balance</th>
                  <th className="border-l px-3 py-2 text-right font-medium">Previous</th>
                  <th className="px-3 py-2 text-right font-medium">Current</th>
                  <th className="px-3 py-2 text-right font-medium">Balance</th>
                  <th className="border-l px-3 py-2 text-left font-medium">Executed</th>
                  <th className="px-2 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.item.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2.5 text-muted-foreground">{r.item.srNo}</td>
                    <td className="min-w-64 max-w-80 px-3 py-2.5">
                      <button className="text-left font-medium hover:text-primary hover:underline cursor-pointer" onClick={() => setViewing(r)}>{r.item.description}</button>
                    </td>
                    <td className="border-l px-3 py-2.5 text-right tabular">{formatNumber(r.item.contractQty, 2)}</td>
                    <td className="px-3 py-2.5">{r.item.uom}</td>
                    <td className="px-3 py-2.5 text-right tabular">{money(r.item.rate)}</td>
                    <td className="px-3 py-2.5 text-right font-medium tabular">{money(r.contractAmount)}</td>
                    <td className="border-l px-3 py-2.5 text-right tabular">{formatNumber(r.previousQty, 2)}</td>
                    <td className={cn("px-3 py-2.5 text-right tabular", r.currentQty > 0 && "font-medium text-primary")}>{formatNumber(r.currentQty, 2)}</td>
                    <td className={cn("px-3 py-2.5 text-right tabular", r.balanceQty < 0 && "text-danger")}>{formatNumber(r.balanceQty, 2)}</td>
                    <td className="border-l px-3 py-2.5 text-right tabular">{money(r.previousAmount)}</td>
                    <td className="px-3 py-2.5 text-right tabular">{money(r.currentAmount)}</td>
                    <td className="px-3 py-2.5 text-right tabular">{money(r.balanceAmount)}</td>
                    <td className="border-l px-3 py-2.5">
                      <div className="flex w-28 items-center gap-2">
                        <Progress value={r.pct * 100} tone={r.pct >= 1 ? "success" : "primary"} />
                        <span className="w-10 text-right text-xs tabular">{formatPct(Math.min(r.pct, 9.99) * 100, 0)}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.item.description}`}><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => setViewing(r)}><Eye /> View details & history</DropdownMenuItem>
                          {canEdit && (
                            <>
                              <DropdownMenuItem onSelect={() => setExecuting(r)}><Ruler /> Update execution</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setItemDialog({ open: true, item: r.item })}><Pencil /> Edit item</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem destructive onSelect={() => setDeleting(r)}><Trash2 /> Delete item</DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-muted/40 font-semibold">
                <tr>
                  <td className="px-3 py-2.5" colSpan={2}>Total</td>
                  <td className="border-l" colSpan={3} />
                  <td className="px-3 py-2.5 text-right tabular">{money(tot.contract)}</td>
                  <td className="border-l" colSpan={3} />
                  <td className="border-l px-3 py-2.5 text-right tabular">{money(tot.prev)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{money(tot.curr)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{money(tot.bal)}</td>
                  <td className="border-l px-3 py-2.5 text-xs">{formatPct(p.progress * 100)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <BoqItemDialog open={itemDialog.open} onOpenChange={(o) => setItemDialog((s) => ({ ...s, open: o }))} projectId={project.id} item={itemDialog.item} nextSrNo={nextSrNo} />
      <ExecutionDialog row={fresh(executing)} onClose={() => setExecuting(null)} projectId={project.id} />
      <BoqItemDetail row={fresh(viewing)} onClose={() => setViewing(null)} canEdit={canEdit} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete BOQ item?"
        description={deleting && <>“{deleting.item.description}” and its {formatNumber(deleting.executedQty, 2)} {deleting.item.uom} of execution history will be removed. Progress will be recalculated.</>}
        confirmLabel="Delete item"
        destructive
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.item.id, { onSuccess: () => { toast.success("BOQ item deleted"); setDeleting(null); } })}
      />
      <ConfirmDialog
        open={closing}
        onOpenChange={setClosing}
        title="Close measurement period?"
        description={<>Current quantities ({formatINR(tot.curr)}) will move to Previous (certified), and a new period starts today — typically done when an RA bill is raised. Progress is unaffected.</>}
        confirmLabel="Close period"
        loading={closePeriod.isPending}
        onConfirm={() => closePeriod.mutate(project.id, { onSuccess: () => { toast.success("Measurement period closed"); setClosing(false); } })}
      />
    </div>
  );
}
