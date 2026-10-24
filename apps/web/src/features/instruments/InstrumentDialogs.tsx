import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileText, Upload, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useForm, type Errors } from "@/hooks/useForm";
import { useAssignInstrument, useCreateInstrument, useUpdateInstrument } from "@/hooks/mutations";
import { useAppData, useScopedData } from "@/hooks/useAppData";
import { instrumentPerDayValue } from "@/domain/assumptions";
import { formatINR, formatINRShort } from "@/lib/format";
import { addDays, todayISO } from "@/lib/dates";
import type { CalibrationCertificate, Instrument, InstrumentCategory } from "@/types/models";

export const INSTRUMENT_CATEGORIES: InstrumentCategory[] = [
  "Measurement",
  "Refrigerant Handling",
  "Air Balancing",
  "Electrical Testing",
  "Power Tools",
  "Safety",
];

type Values = {
  code: string;
  name: string;
  serialNumber: string;
  category: InstrumentCategory | "";
  assetValue: string;
  purchaseDate: string;
  endOfLifeDate: string;
  currentLocation: string;
  calibrationValidUntil: string;
  notes: string;
};

const validate = (v: Values): Errors<Values> => {
  const e: Errors<Values> = {};
  if (!v.name.trim()) e.name = "Instrument name is required";
  if (!v.serialNumber.trim()) e.serialNumber = "Serial number is required";
  if (!v.category) e.category = "Select a category";
  if (!v.assetValue || !(Number(v.assetValue) > 0)) e.assetValue = "Enter the asset value";
  if (v.purchaseDate > todayISO()) e.purchaseDate = "Purchase date cannot be in the future";
  if (!v.endOfLifeDate) e.endOfLifeDate = "Enter the end-of-life date";
  else if (v.endOfLifeDate <= v.purchaseDate) e.endOfLifeDate = "Must be after the purchase date";
  if (!v.currentLocation.trim()) e.currentLocation = "Where is it kept when not on a project?";
  return e;
};

const MAX_CERT_BYTES = 10 * 1024 * 1024;

export function InstrumentFormDialog({ open, onOpenChange, instrument }: { open: boolean; onOpenChange: (o: boolean) => void; instrument?: Instrument }) {
  const create = useCreateInstrument();
  const update = useUpdateInstrument();
  const { instruments } = useAppData();
  const toValues = (i?: Instrument): Values => ({
    code: i?.code ?? "",
    name: i?.name ?? "",
    serialNumber: i?.serialNumber ?? "",
    category: i?.category ?? "",
    assetValue: i ? String(i.assetValue) : "",
    purchaseDate: i?.purchaseDate ?? todayISO(),
    endOfLifeDate: i?.endOfLifeDate ?? addDays(todayISO(), 5 * 365),
    currentLocation: i?.currentLocation ?? "",
    calibrationValidUntil: i?.calibration?.validUntil ?? "",
    notes: i?.notes ?? "",
  });
  const form = useForm<Values>(toValues(instrument), validate);
  const { values: v, errors, set } = form;
  // The certificate file is kept outside the form values because it is not a text field.
  const [certificate, setCertificate] = useState<Omit<CalibrationCertificate, "validUntil"> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      form.reset(toValues(instrument));
      setCertificate(instrument?.calibration ?? null);
    }
  }, [open, instrument?.id]);

  // Existing locations, offered as suggestions so the same store is spelled the same way.
  const knownLocations = [...new Set(instruments.map((i) => i.currentLocation).filter(Boolean))].sort();

  const perDay =
    Number(v.assetValue) > 0 && v.endOfLifeDate > v.purchaseDate
      ? instrumentPerDayValue({ assetValue: Number(v.assetValue), purchaseDate: v.purchaseDate, endOfLifeDate: v.endOfLifeDate })
      : null;

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Calibration certificate must be a PDF");
      return;
    }
    if (file.size > MAX_CERT_BYTES) {
      toast.error("Calibration certificate must be smaller than 10 MB");
      return;
    }
    // Prototype: only file details are kept. The real API will store the PDF in S3.
    setCertificate({ fileName: file.name, size: file.size, mimeType: file.type });
  };

  const submit = form.handleSubmit((vals) => {
    const input = {
      code: vals.code,
      name: vals.name.trim(),
      serialNumber: vals.serialNumber.trim(),
      category: vals.category as InstrumentCategory,
      assetValue: Number(vals.assetValue),
      purchaseDate: vals.purchaseDate,
      endOfLifeDate: vals.endOfLifeDate,
      currentLocation: vals.currentLocation.trim(),
      calibration: certificate ? { ...certificate, validUntil: vals.calibrationValidUntil || null } : null,
      notes: vals.notes,
    };
    const done = (msg: string) => () => {
      toast.success(msg, { description: input.name });
      onOpenChange(false);
    };
    if (instrument) update.mutate({ id: instrument.id, input }, { onSuccess: done("Instrument updated") });
    else create.mutate(input, { onSuccess: done("Instrument added to inventory") });
  });

  const pending = create.isPending || update.isPending;
  const onProject = instrument?.status === "assigned";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={instrument ? "Edit instrument" : "Add instrument"}
        description={instrument ? instrument.code : "Register a new instrument or piece of equipment."}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form="instrument-form" loading={pending}>
              {instrument ? "Save changes" : "Add instrument"}
            </Button>
          </>
        }
      >
        <form id="instrument-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Instrument name" htmlFor="i-name" required error={errors.name} className="sm:col-span-2">
            <Input id="i-name" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Digital Manifold Gauge Set" aria-invalid={!!errors.name} autoFocus />
          </Field>
          <Field label="Instrument ID" htmlFor="i-code" hint={instrument ? undefined : "Leave blank to auto-generate"}>
            <Input id="i-code" value={v.code} onChange={(e) => set("code", e.target.value)} placeholder="INS-0XX" />
          </Field>
          <Field label="Serial number" htmlFor="i-sn" required error={errors.serialNumber}>
            <Input id="i-sn" value={v.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} aria-invalid={!!errors.serialNumber} />
          </Field>
          <Field label="Category" htmlFor="i-cat" required error={errors.category}>
            <Select id="i-cat" value={v.category} onChange={(e) => set("category", e.target.value as InstrumentCategory)} aria-invalid={!!errors.category}>
              <option value="">Select…</option>
              {INSTRUMENT_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Asset value (₹)" htmlFor="i-val" required error={errors.assetValue} hint={v.assetValue ? formatINRShort(Number(v.assetValue)) : undefined}>
            <Input id="i-val" type="number" min={0} value={v.assetValue} onChange={(e) => set("assetValue", e.target.value)} aria-invalid={!!errors.assetValue} />
          </Field>
          <Field label="Purchase date" htmlFor="i-date" error={errors.purchaseDate}>
            <Input id="i-date" type="date" max={todayISO()} value={v.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} />
          </Field>
          <Field label="End-of-life date" htmlFor="i-eol" required error={errors.endOfLifeDate}>
            <Input id="i-eol" type="date" min={v.purchaseDate} value={v.endOfLifeDate} onChange={(e) => set("endOfLifeDate", e.target.value)} aria-invalid={!!errors.endOfLifeDate} />
          </Field>
          <div className="rounded-md bg-muted/60 px-3 py-2 sm:col-span-2">
            <p className="text-xs text-muted-foreground">Per-day value (asset value ÷ days from purchase to end of life)</p>
            <p className="text-sm font-semibold tabular">{perDay === null ? "—" : `${formatINR(perDay)} / day`}</p>
          </div>
          <Field
            label="Current location"
            htmlFor="i-loc"
            required
            error={errors.currentLocation}
            className="sm:col-span-2"
            hint={onProject ? "Where it returns to. While on a project, the project site is shown as its location." : "Store or office where it is kept when not on a project"}
          >
            <Input id="i-loc" list="i-loc-options" value={v.currentLocation} onChange={(e) => set("currentLocation", e.target.value)} placeholder="e.g. Pune HQ store" aria-invalid={!!errors.currentLocation} />
            <datalist id="i-loc-options">
              {knownLocations.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </Field>
          <Field label="Calibration certificate (optional)" className="sm:col-span-2" hint="PDF up to 10 MB (only the file details are kept in this prototype)">
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            {certificate ? (
              <div className="flex items-center gap-3 rounded-md border bg-success-soft/40 p-3">
                <FileText className="size-8 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{certificate.fileName}</p>
                  <p className="flex items-center gap-1 text-xs text-success">
                    <CheckCircle2 className="size-3" /> Attached · {(certificate.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setCertificate(null)} aria-label="Remove calibration certificate">
                  <X />
                </Button>
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
                className="flex w-full flex-col items-center gap-1 rounded-md border border-dashed border-input px-4 py-5 text-sm text-muted-foreground hover:border-primary hover:bg-primary-soft/30 cursor-pointer"
              >
                <Upload className="size-5" />
                <span>
                  <span className="font-medium text-primary">Upload PDF</span> or drag & drop
                </span>
              </button>
            )}
          </Field>
          {certificate && (
            <Field label="Calibration valid until" htmlFor="i-cal" hint="Optional; shown on the instruments list">
              <Input id="i-cal" type="date" value={v.calibrationValidUntil} onChange={(e) => set("calibrationValidUntil", e.target.value)} />
            </Field>
          )}
          <Field label="Notes" htmlFor="i-notes" className="sm:col-span-2">
            <Textarea id="i-notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Accessories, condition…" />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type AssignValues = { projectId: string; engineerId: string };

export function AssignInstrumentDialog({
  open,
  onOpenChange,
  instrument,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  instrument: Instrument | null;
  defaultProjectId?: string;
}) {
  const data = useScopedData();
  const { employeeById } = useAppData();
  const assign = useAssignInstrument();
  const form = useForm<AssignValues>({ projectId: defaultProjectId ?? "", engineerId: "" }, (v) => {
    const e: Errors<AssignValues> = {};
    if (!v.projectId) e.projectId = "Select a project";
    if (!v.engineerId) e.engineerId = "Select an engineer";
    return e;
  });
  const { values: v, errors, set } = form;

  useEffect(() => {
    if (open) form.reset({ projectId: defaultProjectId ?? instrument?.assignedProjectId ?? "", engineerId: "" });
  }, [open, instrument?.id]);

  const projects = data.scopedProjects.filter((p) => p.status === "active" || p.status === "planning" || p.status === "on_hold");
  const onProject = data.assignments.filter((a) => a.projectId === v.projectId && !a.endDate).map((a) => a.employeeId);
  const engineers = data.employees
    .filter((e) => e.isSiteEngineer && e.status !== "inactive")
    .sort((a, b) => Number(onProject.includes(b.id)) - Number(onProject.includes(a.id)));

  const submit = form.handleSubmit((vals) => {
    if (!instrument) return;
    assign.mutate(
      { id: instrument.id, ...vals },
      {
        onSuccess: () => {
          toast.success(`${instrument.name} issued`, { description: `to ${employeeById.get(vals.engineerId)?.name}` });
          onOpenChange(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {instrument && (
        <DialogContent
          title={instrument.status === "assigned" ? "Reassign instrument" : "Assign instrument"}
          description={`${instrument.name} · ${instrument.code}`}
          footer={
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" form="assign-ins-form" loading={assign.isPending}>
                Assign
              </Button>
            </>
          }
        >
          <form id="assign-ins-form" onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Project" htmlFor="ai-project" required error={errors.projectId}>
              <Select id="ai-project" value={v.projectId} onChange={(e) => set("projectId", e.target.value)} aria-invalid={!!errors.projectId}>
                <option value="">Select project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Engineer" htmlFor="ai-eng" required error={errors.engineerId} hint="Engineers assigned to the selected project are listed first">
              <Select id="ai-eng" value={v.engineerId} onChange={(e) => set("engineerId", e.target.value)} aria-invalid={!!errors.engineerId}>
                <option value="">Select engineer…</option>
                {engineers.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} — {e.designation}
                    {onProject.includes(e.id) ? " (on this project)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            {instrument.status === "assigned" && (
              <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
                Currently with {employeeById.get(instrument.assignedEngineerId ?? "")?.name ?? "—"}. Reassigning will close that deployment.
              </p>
            )}
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
