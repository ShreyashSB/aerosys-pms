import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileText, Paperclip, Upload, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/misc";
import { useForm, type Errors } from "@/hooks/useForm";
import { useCreateExpense } from "@/hooks/mutations";
import { useScopedData } from "@/hooks/useAppData";
import { useCurrentUser } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { todayISO } from "@/lib/dates";
import type { ExpenseCategory, Receipt } from "@/types/models";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Travel",
  "Accommodation",
  "Food",
  "Local Conveyance",
  "Site Material",
  "Tools & Consumables",
  "Other",
];

type Values = {
  employeeId: string;
  projectId: string;
  category: ExpenseCategory | "";
  amount: string;
  date: string;
  description: string;
};

const validate = (v: Values): Errors<Values> => {
  const e: Errors<Values> = {};
  if (!v.employeeId) e.employeeId = "Select an employee";
  if (!v.projectId) e.projectId = "Select a project";
  if (!v.category) e.category = "Select a category";
  const amt = Number(v.amount);
  if (!v.amount || !(amt > 0)) e.amount = "Enter an amount greater than 0";
  else if (amt > 500000) e.amount = "Amounts above ₹5,00,000 must be raised as a project cost";
  if (!v.date) e.date = "Date is required";
  else if (v.date > todayISO()) e.date = "Expense date cannot be in the future";
  if (!v.description.trim()) e.description = "Add a short description";
  return e;
};

export function ExpenseFormDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Pre-select and lock the project (when adding from the project page). */
  projectId?: string;
}) {
  const { user } = useCurrentUser();
  const data = useScopedData();
  const create = useCreateExpense();
  const forOthers = can(user.role, "expense.createForOthers");

  const initial: Values = { employeeId: user.employeeId, projectId: projectId ?? "", category: "", amount: "", date: todayISO(), description: "" };
  const form = useForm<Values>(initial, validate);
  const { values: v, errors, set } = form;

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      form.reset(initial);
      setReceipt(null);
      setUploadPct(null);
    }
  }, [open, projectId]);

  // Projects the selected employee can book against
  const openProjects = data.scopedProjects.filter((p) => p.status === "active" || p.status === "planning" || p.status === "on_hold");
  const employeeProjects =
    user.role === "site_engineer"
      ? openProjects.filter((p) => data.assignments.some((a) => a.projectId === p.id && a.employeeId === user.employeeId && !a.endDate))
      : openProjects;
  const engineersOnProject = v.projectId
    ? data.employees.filter((e) => data.assignments.some((a) => a.projectId === v.projectId && a.employeeId === e.id))
    : [];
  const employeeOptions = forOthers
    ? [...new Map([...engineersOnProject, ...data.employees.filter((e) => e.status === "active")].map((e) => [e.id, e])).values()]
    : data.employees.filter((e) => e.id === user.employeeId);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Receipt must be smaller than 5 MB");
      return;
    }
    // Simulated upload with progress
    setUploadPct(0);
    const meta: Receipt = { fileName: file.name, size: file.size, mimeType: file.type || "application/octet-stream" };
    const finish = (dataUrl?: string) => {
      let pct = 0;
      const timer = setInterval(() => {
        pct += 20;
        setUploadPct(pct);
        if (pct >= 100) {
          clearInterval(timer);
          setReceipt({ ...meta, dataUrl });
          setUploadPct(null);
        }
      }, 120);
    };
    if (file.type.startsWith("image/") && file.size < 400 * 1024) {
      const reader = new FileReader();
      reader.onload = () => finish(reader.result as string);
      reader.readAsDataURL(file);
    } else finish();
  };

  const submit = form.handleSubmit((vals) => {
    create.mutate(
      {
        employeeId: vals.employeeId,
        projectId: vals.projectId,
        category: vals.category as ExpenseCategory,
        amount: Number(vals.amount),
        date: vals.date,
        description: vals.description.trim(),
        receipt,
      },
      {
        onSuccess: (exp) => {
          toast.success("Expense submitted for approval", { description: `${exp.code} is now pending review.` });
          onOpenChange(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        side="right"
        title="Add expense"
        description="Submitted expenses go to the project manager / management for approval."
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="expense-form" loading={create.isPending} disabled={uploadPct !== null}>
              Submit expense
            </Button>
          </>
        }
      >
        <form id="expense-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Project" htmlFor="x-project" required error={errors.projectId} className="sm:col-span-2">
            <Select id="x-project" value={v.projectId} onChange={(e) => set("projectId", e.target.value)} disabled={!!projectId} aria-invalid={!!errors.projectId}>
              <option value="">Select project…</option>
              {(projectId ? data.scopedProjects.filter((p) => p.id === projectId) : employeeProjects).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.site}
                </option>
              ))}
            </Select>
            {user.role === "site_engineer" && employeeProjects.length === 0 && (
              <p className="text-xs text-warning">You have no active project assignments to book expenses against.</p>
            )}
          </Field>
          <Field label="Employee" htmlFor="x-emp" required error={errors.employeeId} className="sm:col-span-2">
            <Select id="x-emp" value={v.employeeId} onChange={(e) => set("employeeId", e.target.value)} disabled={!forOthers} aria-invalid={!!errors.employeeId}>
              <option value="">Select employee…</option>
              {employeeOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.code})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category" htmlFor="x-cat" required error={errors.category}>
            <Select id="x-cat" value={v.category} onChange={(e) => set("category", e.target.value as ExpenseCategory)} aria-invalid={!!errors.category}>
              <option value="">Select…</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Amount (₹)" htmlFor="x-amt" required error={errors.amount}>
            <Input id="x-amt" type="number" min={0} step={10} value={v.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0" aria-invalid={!!errors.amount} />
          </Field>
          <Field label="Date" htmlFor="x-date" required error={errors.date}>
            <Input id="x-date" type="date" max={todayISO()} value={v.date} onChange={(e) => set("date", e.target.value)} aria-invalid={!!errors.date} />
          </Field>
          <div className="hidden sm:block" />
          <Field label="Description" htmlFor="x-desc" required error={errors.description} className="sm:col-span-2">
            <Textarea id="x-desc" value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. Hotel stay for 2 nights during chiller commissioning" aria-invalid={!!errors.description} />
          </Field>
          <Field label="Receipt" className="sm:col-span-2" hint="JPG, PNG or PDF up to 5 MB (stored locally in this prototype)">
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            {receipt ? (
              <div className="flex items-center gap-3 rounded-md border bg-success-soft/40 p-3">
                {receipt.dataUrl ? (
                  <img src={receipt.dataUrl} alt="" className="size-10 rounded object-cover" />
                ) : (
                  <FileText className="size-8 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{receipt.fileName}</p>
                  <p className="flex items-center gap-1 text-xs text-success">
                    <CheckCircle2 className="size-3" /> Uploaded · {(receipt.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setReceipt(null)} aria-label="Remove receipt">
                  <X />
                </Button>
              </div>
            ) : uploadPct !== null ? (
              <div className="rounded-md border p-3">
                <p className="mb-2 flex items-center gap-2 text-sm">
                  <Paperclip className="size-4" /> Uploading… {uploadPct}%
                </p>
                <Progress value={uploadPct} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onFile(e.dataTransfer.files?.[0]);
                }}
                className="flex w-full flex-col items-center gap-1 rounded-md border border-dashed border-input px-4 py-6 text-sm text-muted-foreground hover:border-primary hover:bg-primary-soft/30 cursor-pointer"
              >
                <Upload className="size-5" />
                <span>
                  <span className="font-medium text-primary">Click to upload</span> or drag & drop
                </span>
              </button>
            )}
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
