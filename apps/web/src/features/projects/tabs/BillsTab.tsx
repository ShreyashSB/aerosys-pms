import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Paperclip, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/common/States";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { StatCard } from "@/components/common/StatCard";
import { useCurrentUser } from "@/auth/AuthContext";
import { useAppData } from "@/hooks/useAppData";
import { useCreateBill, useDeleteBill } from "@/hooks/mutations";
import { useForm, type Errors } from "@/hooks/useForm";
import type { ProjectPerformance } from "@/domain/performance";
import { todayISO } from "@/lib/dates";
import { formatDate, formatINR } from "@/lib/format";
import type { BillKind, Project, ProjectBill, Receipt } from "@/types/models";

export const BILL_KIND_LABEL: Record<BillKind, string> = { vendor_bill: "Vendor bill", client_invoice: "Client invoice" };

/**
 * Bills and invoices that Accounts enters against a project. Vendor bills add
 * to the project's cost; client invoices track how much has been billed.
 */
export function BillsTab({ project, perf: p, canManage }: { project: Project; perf: ProjectPerformance; canManage: boolean }) {
  const data = useAppData();
  const del = useDeleteBill();
  const [adding, setAdding] = useState<BillKind | null>(null);
  const [deleting, setDeleting] = useState<ProjectBill | null>(null);
  const bills = data.bills.filter((b) => b.projectId === project.id).sort((a, b) => b.date.localeCompare(a.date));
  const vendorTotal = bills.filter((b) => b.kind === "vendor_bill").reduce((s, b) => s + b.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Invoiced to client" value={formatINR(p.invoicedToDate)} hint={`${bills.filter((b) => b.kind === "client_invoice").length} invoices`} />
        <StatCard label="Earned value" value={formatINR(p.earnedValue)} hint="Work order value × progress" />
        <StatCard
          label="Yet to invoice"
          value={formatINR(Math.max(0, p.earnedValue - p.invoicedToDate))}
          hint={p.invoicedToDate > p.earnedValue ? "Invoiced ahead of progress" : "Earned but not billed"}
        />
        <StatCard label="Vendor bills" value={formatINR(vendorTotal)} hint="Counted in project cost" />
      </div>

      {canManage && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setAdding("vendor_bill")}><Plus /> Add vendor bill</Button>
          <Button onClick={() => setAdding("client_invoice")}><Plus /> Add client invoice</Button>
        </div>
      )}

      <Card>
        <CardContent className="px-0 py-0">
          {bills.length === 0 ? (
            <EmptyState icon={<FileText />} title="No bills or invoices yet" description="Accounts adds vendor bills and client invoices here as they come in." />
          ) : (
            <>
              {/* Phone: one card per bill */}
              <ul className="divide-y md:hidden">
                {bills.map((b) => (
                  <li key={b.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={b.kind === "vendor_bill" ? "warning" : "info"}>{BILL_KIND_LABEL[b.kind]}</Badge>
                        <span className="text-sm font-medium">{b.number}</span>
                      </div>
                      <p className="truncate text-sm">{b.party}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(b.date)}
                        {b.attachment && <> · <Paperclip className="inline size-3" /> {b.attachment.fileName}</>}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-medium tabular">{formatINR(b.amount)}</span>
                      {canManage && (
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(b)} aria-label={`Delete ${b.number}`}><Trash2 className="text-muted-foreground" /></Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-5 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                      <th className="px-3 py-2 text-left font-medium">Number</th>
                      <th className="px-3 py-2 text-left font-medium">Vendor / client</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                      <th className="px-3 py-2 text-left font-medium">File</th>
                      <th className="px-5 py-2 text-left font-medium">Added by</th>
                      {canManage && <th className="w-10" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {bills.map((b) => (
                      <tr key={b.id}>
                        <td className="whitespace-nowrap px-5 py-2.5">{formatDate(b.date)}</td>
                        <td className="px-3 py-2.5"><Badge tone={b.kind === "vendor_bill" ? "warning" : "info"}>{BILL_KIND_LABEL[b.kind]}</Badge></td>
                        <td className="px-3 py-2.5 font-medium">{b.number}</td>
                        <td className="max-w-56 px-3 py-2.5">
                          <p className="truncate">{b.party}</p>
                          {b.notes && <p className="truncate text-xs text-muted-foreground">{b.notes}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium tabular">{formatINR(b.amount)}</td>
                        <td className="max-w-48 px-3 py-2.5">
                          {b.attachment ? (
                            b.attachment.dataUrl ? (
                              <a href={b.attachment.dataUrl} download={b.attachment.fileName} className="flex items-center gap-1 truncate text-primary hover:underline">
                                <Paperclip className="size-3.5 shrink-0" /> {b.attachment.fileName}
                              </a>
                            ) : (
                              <span className="flex items-center gap-1 truncate text-muted-foreground"><Paperclip className="size-3.5 shrink-0" /> {b.attachment.fileName}</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-muted-foreground">{data.employeeById.get(b.createdById)?.name ?? "—"}</td>
                        {canManage && (
                          <td className="pr-3">
                            <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(b)} aria-label={`Delete ${b.number}`}><Trash2 className="text-muted-foreground" /></Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <BillDialog kind={adding} project={project} onClose={() => setAdding(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting ? BILL_KIND_LABEL[deleting.kind].toLowerCase() : ""} ${deleting?.number ?? ""}?`}
        description="It will be removed from the project's figures."
        confirmLabel="Delete"
        destructive
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => { toast.success("Deleted"); setDeleting(null); } })}
      />
    </div>
  );
}

type Values = { kind: BillKind; number: string; party: string; amount: string; date: string; notes: string };

function validate(v: Values): Errors<Values> {
  const e: Errors<Values> = {};
  if (!v.number.trim()) e.number = "Number is required";
  if (!v.party.trim()) e.party = v.kind === "vendor_bill" ? "Vendor is required" : "Client is required";
  if (!(Number(v.amount) > 0)) e.amount = "Enter an amount greater than 0";
  if (!v.date) e.date = "Date is required";
  return e;
}

function BillDialog({ kind, project, onClose }: { kind: BillKind | null; project: Project; onClose: () => void }) {
  const { user } = useCurrentUser();
  const create = useCreateBill();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<Receipt | null>(null);
  const initial = (k: BillKind): Values => ({ kind: k, number: "", party: k === "client_invoice" ? project.clientName : "", amount: "", date: todayISO(), notes: "" });
  const form = useForm<Values>(initial(kind ?? "vendor_bill"), validate);
  const { values: v, errors, set } = form;

  useEffect(() => {
    if (kind) {
      form.reset(initial(kind));
      setFile(null);
    }
  }, [kind]);

  const onFile = (f: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File must be smaller than 10 MB");
      return;
    }
    const meta: Receipt = { fileName: f.name, size: f.size, mimeType: f.type || "application/octet-stream" };
    // Small files are kept so they can be opened again in this prototype; the real app stores them in object storage.
    if (f.size < 400 * 1024) {
      const reader = new FileReader();
      reader.onload = () => setFile({ ...meta, dataUrl: reader.result as string });
      reader.readAsDataURL(f);
    } else setFile(meta);
  };

  const submit = form.handleSubmit((vals) => {
    create.mutate(
      {
        actorId: user.employeeId,
        input: { projectId: project.id, kind: vals.kind, number: vals.number, party: vals.party, amount: Number(vals.amount), date: vals.date, attachment: file, notes: vals.notes },
      },
      {
        onSuccess: (b) => {
          toast.success(`${BILL_KIND_LABEL[b.kind]} added`, { description: `${b.number} · ${formatINR(b.amount)}` });
          onClose();
        },
      },
    );
  });

  return (
    <Dialog open={!!kind} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-lg"
        title={kind === "client_invoice" ? "Add client invoice" : "Add vendor bill"}
        description={project.name}
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={create.isPending}>Cancel</Button>
            <Button type="submit" form="bill-form" loading={create.isPending}>Save</Button>
          </>
        }
      >
        <form id="bill-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Type" htmlFor="b-kind">
            <Select
              id="b-kind"
              value={v.kind}
              onChange={(e) => {
                const k = e.target.value as BillKind;
                set("kind", k);
                if (k === "client_invoice" && !v.party) set("party", project.clientName);
              }}
            >
              <option value="vendor_bill">Vendor bill (cost)</option>
              <option value="client_invoice">Client invoice (billed)</option>
            </Select>
          </Field>
          <Field label={v.kind === "client_invoice" ? "Invoice no." : "Bill no."} htmlFor="b-no" required error={errors.number}>
            <Input id="b-no" value={v.number} onChange={(e) => set("number", e.target.value)} placeholder={v.kind === "client_invoice" ? "e.g. AER/12/RA-3" : "e.g. INV-7342"} aria-invalid={!!errors.number} />
          </Field>
          <Field label={v.kind === "client_invoice" ? "Client" : "Vendor"} htmlFor="b-party" required error={errors.party} className="sm:col-span-2">
            <Input id="b-party" value={v.party} onChange={(e) => set("party", e.target.value)} aria-invalid={!!errors.party} />
          </Field>
          <Field label="Amount (₹)" htmlFor="b-amt" required error={errors.amount}>
            <Input id="b-amt" type="number" min={0} step={100} value={v.amount} onChange={(e) => set("amount", e.target.value)} aria-invalid={!!errors.amount} />
          </Field>
          <Field label="Date" htmlFor="b-date" required error={errors.date}>
            <Input id="b-date" type="date" max={todayISO()} value={v.date} onChange={(e) => set("date", e.target.value)} aria-invalid={!!errors.date} />
          </Field>
          <Field label="File" className="sm:col-span-2" hint="PDF or image up to 10 MB">
            <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            {file ? (
              <div className="flex items-center gap-3 rounded-md border p-2.5">
                <FileText className="size-6 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</p>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setFile(null)} aria-label="Remove file"><X /></Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full" onClick={() => fileRef.current?.click()}><Paperclip /> Attach file</Button>
            )}
          </Field>
          <Field label="Notes" htmlFor="b-notes" className="sm:col-span-2">
            <Textarea id="b-notes" rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. Running account bill 3, material supplied to site" />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
