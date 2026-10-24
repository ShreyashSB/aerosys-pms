import { useEffect } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/misc";
import { useForm, type Errors } from "@/hooks/useForm";
import { useAddExecution, useCreateBoqItem, useDeleteExecution, useUpdateBoqItem } from "@/hooks/mutations";
import { useAppData } from "@/hooks/useAppData";
import type { BoqRow } from "@/domain/performance";
import { todayISO } from "@/lib/dates";
import { formatDate, formatINR, formatNumber, formatPct } from "@/lib/format";
import type { BoqItem } from "@/types/models";

const UOMS = ["Nos", "Set", "Sqm", "Rmt", "Kg", "Lot", "Job"];

type ItemValues = { srNo: string; description: string; uom: string; contractQty: string; rate: string };

export function BoqItemDialog({
  open,
  onOpenChange,
  projectId,
  item,
  nextSrNo,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  item?: BoqItem | null;
  nextSrNo: string;
}) {
  const create = useCreateBoqItem();
  const update = useUpdateBoqItem();
  const toValues = (): ItemValues =>
    item
      ? { srNo: item.srNo, description: item.description, uom: item.uom, contractQty: String(item.contractQty), rate: String(item.rate) }
      : { srNo: nextSrNo, description: "", uom: "Nos", contractQty: "", rate: "" };
  const form = useForm<ItemValues>(toValues(), (v) => {
    const e: Errors<ItemValues> = {};
    if (!v.description.trim()) e.description = "Description is required";
    if (!v.uom.trim()) e.uom = "UOM is required";
    if (!(Number(v.contractQty) > 0)) e.contractQty = "Enter contract quantity";
    if (v.rate === "" || !(Number(v.rate) >= 0)) e.rate = "Enter rate";
    return e;
  });
  const { values: v, errors, set } = form;
  useEffect(() => {
    if (open) form.reset(toValues());
  }, [open, item?.id]);

  const amount = (Number(v.contractQty) || 0) * (Number(v.rate) || 0);
  const submit = form.handleSubmit((vals) => {
    const input = { projectId, srNo: vals.srNo.trim() || nextSrNo, description: vals.description.trim(), uom: vals.uom.trim(), contractQty: Number(vals.contractQty), rate: Number(vals.rate) };
    const done = (msg: string) => () => {
      toast.success(msg, { description: `${input.description} · ${formatINR(amount)}` });
      onOpenChange(false);
    };
    if (item) update.mutate({ id: item.id, input }, { onSuccess: done("BOQ item updated") });
    else create.mutate(input, { onSuccess: done("BOQ item added") });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={item ? "Edit BOQ item" : "Add BOQ item"}
        description="Work order / Annexure line item"
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" form="boq-form" loading={create.isPending || update.isPending}>{item ? "Save item" : "Add item"}</Button>
          </>
        }
      >
        <form id="boq-form" onSubmit={submit} className="grid grid-cols-4 gap-4" noValidate>
          <Field label="Sr. no." htmlFor="b-sr">
            <Input id="b-sr" value={v.srNo} onChange={(e) => set("srNo", e.target.value)} />
          </Field>
          <Field label="Item description" htmlFor="b-desc" required error={errors.description} className="col-span-3">
            <Input id="b-desc" value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. Air Handling Unit installation" aria-invalid={!!errors.description} autoFocus />
          </Field>
          <Field label="Contract qty" htmlFor="b-qty" required error={errors.contractQty} className="col-span-2 sm:col-span-1">
            <Input id="b-qty" type="number" min={0} step="any" value={v.contractQty} onChange={(e) => set("contractQty", e.target.value)} aria-invalid={!!errors.contractQty} />
          </Field>
          <Field label="UOM" htmlFor="b-uom" required error={errors.uom} className="col-span-2 sm:col-span-1">
            <Input id="b-uom" list="uom-list" value={v.uom} onChange={(e) => set("uom", e.target.value)} aria-invalid={!!errors.uom} />
            <datalist id="uom-list">{UOMS.map((u) => <option key={u} value={u} />)}</datalist>
          </Field>
          <Field label="Rate (₹)" htmlFor="b-rate" required error={errors.rate} className="col-span-2 sm:col-span-1">
            <Input id="b-rate" type="number" min={0} step="any" value={v.rate} onChange={(e) => set("rate", e.target.value)} aria-invalid={!!errors.rate} />
          </Field>
          <div className="col-span-2 flex flex-col justify-end sm:col-span-1">
            <p className="text-xs text-muted-foreground">Contract amount</p>
            <p className="h-9 content-center font-semibold tabular">{formatINR(amount)}</p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ExeValues = { date: string; qty: string; remarks: string };

/** Manual measurement update (e.g. from a joint measurement sheet). */
export function ExecutionDialog({ row, onClose, projectId }: { row: BoqRow | null; onClose: () => void; projectId: string }) {
  const add = useAddExecution();
  const form = useForm<ExeValues>({ date: todayISO(), qty: "", remarks: "" }, (v) => {
    const e: Errors<ExeValues> = {};
    const q = Number(v.qty);
    if (!v.qty || !q) e.qty = "Enter quantity (negative to correct)";
    else if (row && row.executedQty + q < 0) e.qty = "Cannot go below zero executed";
    if (!v.date) e.date = "Date is required";
    else if (v.date > todayISO()) e.date = "Cannot be a future date";
    return e;
  });
  const { values: v, errors, set } = form;
  useEffect(() => {
    if (row) form.reset({ date: todayISO(), qty: "", remarks: "" });
  }, [row?.item.id]);
  const q = Number(v.qty) || 0;

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      {row && (
        <DialogContent
          title="Update execution"
          description={`${row.item.srNo}. ${row.item.description}`}
          footer={
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" form="exe-form" loading={add.isPending}>Record quantity</Button>
            </>
          }
        >
          <form
            id="exe-form"
            noValidate
            onSubmit={form.handleSubmit((vals) =>
              add.mutate(
                { projectId, boqItemId: row.item.id, date: vals.date, qty: Number(vals.qty), remarks: vals.remarks.trim() },
                {
                  onSuccess: () => {
                    toast.success("Execution recorded", { description: `${formatNumber(Number(vals.qty), 2)} ${row.item.uom} · ${formatINR(Number(vals.qty) * row.item.rate)} — progress, earned value and running PPI updated.` });
                    onClose();
                  },
                },
              ),
            )}
            className="space-y-4"
          >
            <div className="grid grid-cols-3 gap-3 rounded-md bg-muted/50 p-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Contract</p><p className="font-medium tabular">{formatNumber(row.item.contractQty, 2)} {row.item.uom}</p></div>
              <div><p className="text-xs text-muted-foreground">Executed</p><p className="font-medium tabular">{formatNumber(row.executedQty, 2)}</p></div>
              <div><p className="text-xs text-muted-foreground">Balance</p><p className="font-medium tabular">{formatNumber(row.balanceQty, 2)}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date" htmlFor="x-date" required error={errors.date}>
                <Input id="x-date" type="date" max={todayISO()} value={v.date} onChange={(e) => set("date", e.target.value)} />
              </Field>
              <Field label={`Quantity (${row.item.uom})`} htmlFor="x-qty" required error={errors.qty} hint={q ? `${formatINR(q * row.item.rate)} value` : "Use a negative value to correct"}>
                <Input id="x-qty" type="number" step="any" value={v.qty} onChange={(e) => set("qty", e.target.value)} aria-invalid={!!errors.qty} autoFocus />
              </Field>
            </div>
            <Field label="Remarks" htmlFor="x-rem">
              <Textarea id="x-rem" rows={2} value={v.remarks} onChange={(e) => set("remarks", e.target.value)} placeholder="e.g. As per joint measurement with client" />
            </Field>
            {q > row.balanceQty && q > 0 && <p className="text-xs text-warning">This exceeds the balance quantity – check whether a variation order applies.</p>}
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

/** Item detail with its full execution history (daily logs + manual measurements). */
export function BoqItemDetail({ row, onClose, canEdit }: { row: BoqRow | null; onClose: () => void; canEdit: boolean }) {
  const data = useAppData();
  const del = useDeleteExecution();
  const history = row ? data.boqExecutions.filter((x) => x.boqItemId === row.item.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      {row && (
        <DialogContent side="right" className="max-w-xl" title={`${row.item.srNo}. ${row.item.description}`} description={`${formatNumber(row.item.contractQty, 2)} ${row.item.uom} @ ${formatINR(row.item.rate)} = ${formatINR(row.contractAmount)}`}>
          <div className="space-y-5 text-sm">
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Executed</span><span>{formatPct(row.pct * 100)}</span></div>
              <Progress value={row.pct * 100} tone={row.pct >= 1 ? "success" : "primary"} />
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b"><th className="py-1.5 text-left font-medium" /><th className="py-1.5 text-right font-medium">Quantity</th><th className="py-1.5 text-right font-medium">Amount</th></tr>
              </thead>
              <tbody className="divide-y">
                {([["Contract", row.item.contractQty, row.contractAmount], ["Previous (certified)", row.previousQty, row.previousAmount], ["Current period", row.currentQty, row.currentAmount], ["Balance", row.balanceQty, row.balanceAmount]] as const).map(([l, q, a]) => (
                  <tr key={l}><td className="py-1.5">{l}</td><td className="py-1.5 text-right tabular">{formatNumber(q, 2)} {row.item.uom}</td><td className="py-1.5 text-right tabular">{formatINR(a)}</td></tr>
                ))}
              </tbody>
            </table>
            <section>
              <h3 className="mb-2 font-semibold">Execution history ({history.length})</h3>
              <div className="max-h-96 divide-y overflow-y-auto rounded-md border">
                {history.length === 0 && <p className="p-3 text-muted-foreground">No quantity executed yet.</p>}
                {history.map((x) => (
                  <div key={x.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      {formatDate(x.date)} <span className="text-xs text-muted-foreground">· {x.dailyLogId ? "Daily log" : "Manual measurement"}{x.remarks ? ` · ${x.remarks}` : ""}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular">{formatNumber(x.qty, 2)} {row.item.uom}</span>
                      {canEdit && !x.dailyLogId && (
                        <Button variant="ghost" size="icon-sm" onClick={() => del.mutate(x.id, { onSuccess: () => toast.success("Entry removed") })} aria-label="Delete entry"><Trash2 className="text-muted-foreground" /></Button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
