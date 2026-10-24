import { useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useForm, type Errors } from "@/hooks/useForm";
import { useAssignInstrument, useCreateInstrument, useUpdateInstrument } from "@/hooks/mutations";
import { useAppData, useScopedData } from "@/hooks/useAppData";
import { formatINRShort } from "@/lib/format";
import { todayISO } from "@/lib/dates";
import type { Instrument, InstrumentCategory } from "@/types/models";

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
  purchaseValue: string;
  purchaseDate: string;
  notes: string;
};

const validate = (v: Values): Errors<Values> => {
  const e: Errors<Values> = {};
  if (!v.name.trim()) e.name = "Instrument name is required";
  if (!v.serialNumber.trim()) e.serialNumber = "Serial number is required";
  if (!v.category) e.category = "Select a category";
  if (!v.purchaseValue || !(Number(v.purchaseValue) > 0)) e.purchaseValue = "Enter the purchase value";
  if (v.purchaseDate > todayISO()) e.purchaseDate = "Purchase date cannot be in the future";
  return e;
};

export function InstrumentFormDialog({ open, onOpenChange, instrument }: { open: boolean; onOpenChange: (o: boolean) => void; instrument?: Instrument }) {
  const create = useCreateInstrument();
  const update = useUpdateInstrument();
  const toValues = (i?: Instrument): Values => ({
    code: i?.code ?? "",
    name: i?.name ?? "",
    serialNumber: i?.serialNumber ?? "",
    category: i?.category ?? "",
    purchaseValue: i ? String(i.purchaseValue) : "",
    purchaseDate: i?.purchaseDate ?? todayISO(),
    notes: i?.notes ?? "",
  });
  const form = useForm<Values>(toValues(instrument), validate);
  const { values: v, errors, set } = form;

  useEffect(() => {
    if (open) form.reset(toValues(instrument));
  }, [open, instrument?.id]);

  const submit = form.handleSubmit((vals) => {
    const input = {
      code: vals.code,
      name: vals.name.trim(),
      serialNumber: vals.serialNumber.trim(),
      category: vals.category as InstrumentCategory,
      purchaseValue: Number(vals.purchaseValue),
      purchaseDate: vals.purchaseDate,
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
          <Field label="Purchase value (₹)" htmlFor="i-val" required error={errors.purchaseValue} hint={v.purchaseValue ? formatINRShort(Number(v.purchaseValue)) : undefined}>
            <Input id="i-val" type="number" min={0} value={v.purchaseValue} onChange={(e) => set("purchaseValue", e.target.value)} aria-invalid={!!errors.purchaseValue} />
          </Field>
          <Field label="Purchase date" htmlFor="i-date" error={errors.purchaseDate}>
            <Input id="i-date" type="date" max={todayISO()} value={v.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} />
          </Field>
          <Field label="Notes" htmlFor="i-notes" className="sm:col-span-2">
            <Textarea id="i-notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Calibration due, accessories, condition…" />
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
