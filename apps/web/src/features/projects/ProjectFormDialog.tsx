import { useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useForm, type Errors } from "@/hooks/useForm";
import { useCreateProject, useUpdateProject } from "@/hooks/mutations";
import { useAppData } from "@/hooks/useAppData";
import { useAuth } from "@/auth/AuthContext";
import { PROJECT_STATUS } from "@/components/common/StatusBadges";
import { addDays, todayISO } from "@/lib/dates";
import { formatINRShort, formatPerMd } from "@/lib/format";
import { ppi } from "@/domain/assumptions";
import type { Project, ProjectStatus } from "@/types/models";

type Values = {
  name: string;
  clientName: string;
  site: string;
  managerId: string;
  contractValue: string;
  estimatedCost: string;
  allottedManDays: string;
  allottedExpenses: string;
  startDate: string;
  endDate: string;
  description: string;
  status: ProjectStatus;
};

function toValues(p?: Project): Values {
  return {
    name: p?.name ?? "",
    clientName: p?.clientName ?? "",
    site: p?.site ?? "",
    managerId: p?.managerId ?? "",
    contractValue: p ? String(p.contractValue) : "",
    estimatedCost: p ? String(p.estimatedCost) : "",
    allottedManDays: p ? String(p.allottedManDays) : "",
    allottedExpenses: p ? String(p.allottedExpenses) : "",
    startDate: p?.startDate ?? todayISO(),
    endDate: p?.endDate ?? addDays(todayISO(), 180),
    description: p?.description ?? "",
    status: p?.status ?? "planning",
  };
}

function validate(v: Values): Errors<Values> {
  const e: Errors<Values> = {};
  if (!v.name.trim()) e.name = "Project name is required";
  else if (v.name.trim().length < 4) e.name = "Name must be at least 4 characters";
  if (!v.clientName.trim()) e.clientName = "Client is required";
  if (!v.site.trim()) e.site = "Site / location is required";
  if (!v.managerId) e.managerId = "Select a project manager";
  const cv = Number(v.contractValue);
  if (!v.contractValue || !(cv > 0)) e.contractValue = "Enter a contract value greater than 0";
  const ec = Number(v.estimatedCost);
  if (v.estimatedCost && !(ec >= 0)) e.estimatedCost = "Enter a valid amount";
  else if (ec > cv * 1.5 && cv > 0) e.estimatedCost = "Estimated cost looks too high vs. contract value";
  if (!(Number(v.allottedManDays) > 0)) e.allottedManDays = "Enter allotted man-days (PPI baseline)";
  if (v.allottedExpenses !== "" && !(Number(v.allottedExpenses) >= 0)) e.allottedExpenses = "Enter a valid amount";
  if (!v.startDate) e.startDate = "Start date is required";
  if (!v.endDate) e.endDate = "Expected completion is required";
  else if (v.startDate && v.endDate < v.startDate) e.endDate = "Must be after start date";
  return e;
}

export function ProjectFormDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (o: boolean) => void; project?: Project }) {
  const { employees, projects } = useAppData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const create = useCreateProject();
  const update = useUpdateProject();
  const form = useForm<Values>(toValues(project), validate);
  const { values: v, errors, set } = form;

  useEffect(() => {
    if (open) form.reset(toValues(project));
  }, [open, project?.id]);

  const managers = employees.filter((e) => e.department === "Projects" || e.department === "Management");
  const clients = Array.from(new Set(projects.map((p) => p.clientName))).sort();
  const lockManager = user?.role === "project_manager";

  const submit = form.handleSubmit((vals) => {
    const input = {
      name: vals.name.trim(),
      clientName: vals.clientName.trim(),
      site: vals.site.trim(),
      managerId: vals.managerId,
      contractValue: Number(vals.contractValue),
      estimatedCost: vals.estimatedCost ? Number(vals.estimatedCost) : Math.round(Number(vals.contractValue) * 0.78),
      allottedManDays: Number(vals.allottedManDays),
      allottedExpenses: vals.allottedExpenses ? Number(vals.allottedExpenses) : 0,
      startDate: vals.startDate,
      endDate: vals.endDate,
      description: vals.description.trim(),
      status: vals.status,
    };
    if (project) {
      update.mutate(
        { id: project.id, input },
        {
          onSuccess: () => {
            toast.success("Project updated", { description: input.name });
            onOpenChange(false);
          },
        },
      );
    } else {
      create.mutate(input, {
        onSuccess: (created) => {
          toast.success("Project created", {
            description: `${created.name} is now available for assignments and expenses.`,
            action: { label: "Open", onClick: () => navigate(`/projects/${created.id}`) },
          });
          onOpenChange(false);
        },
      });
    }
  });

  const cv = Number(v.contractValue);
  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        side="right"
        className="max-w-xl"
        title={project ? "Edit project" : "Create project"}
        description={project ? project.code : "Set up a new HVAC project, client site and project manager."}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form="project-form" loading={pending}>
              {project ? "Save changes" : "Create project"}
            </Button>
          </>
        }
      >
        <form id="project-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Project name" htmlFor="p-name" required error={errors.name} className="sm:col-span-2">
            <Input id="p-name" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Phoenix Mall HVAC Retrofit" aria-invalid={!!errors.name} autoFocus />
          </Field>
          <Field label="Client" htmlFor="p-client" required error={errors.clientName}>
            <Input id="p-client" list="client-list" value={v.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Client company" aria-invalid={!!errors.clientName} />
            <datalist id="client-list">
              {clients.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Site / location" htmlFor="p-site" required error={errors.site}>
            <Input id="p-site" value={v.site} onChange={(e) => set("site", e.target.value)} placeholder="e.g. Hinjewadi, Pune" aria-invalid={!!errors.site} />
          </Field>
          <Field label="Project manager" htmlFor="p-mgr" required error={errors.managerId} hint={lockManager ? "Only management can reassign the project manager" : undefined}>
            <Select id="p-mgr" value={v.managerId} onChange={(e) => set("managerId", e.target.value)} aria-invalid={!!errors.managerId} disabled={lockManager}>
              <option value="">Select manager…</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.designation}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="p-status">
            <Select id="p-status" value={v.status} onChange={(e) => set("status", e.target.value as ProjectStatus)}>
              {(Object.keys(PROJECT_STATUS) as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Work order value (₹)" htmlFor="p-cv" required error={errors.contractValue} hint={cv > 0 ? formatINRShort(cv) : undefined}>
            <Input id="p-cv" type="number" min={0} step={1000} value={v.contractValue} onChange={(e) => set("contractValue", e.target.value)} placeholder="e.g. 5000000" aria-invalid={!!errors.contractValue} />
          </Field>
          <Field
            label="Budgeted total cost (₹)"
            htmlFor="p-ec"
            error={errors.estimatedCost}
            hint={v.estimatedCost ? formatINRShort(Number(v.estimatedCost)) : "Defaults to 78% of work order value"}
          >
            <Input id="p-ec" type="number" min={0} step={1000} value={v.estimatedCost} onChange={(e) => set("estimatedCost", e.target.value)} aria-invalid={!!errors.estimatedCost} />
          </Field>
          <Field
            label="Allotted man-days"
            htmlFor="p-md"
            required
            error={errors.allottedManDays}
            hint={cv > 0 && Number(v.allottedManDays) > 0 ? `PPI baseline = ${formatPerMd(ppi(cv, Number(v.allottedManDays)))}` : "Used as the PPI baseline"}
          >
            <Input id="p-md" type="number" min={0} step={5} value={v.allottedManDays} onChange={(e) => set("allottedManDays", e.target.value)} placeholder="e.g. 250" aria-invalid={!!errors.allottedManDays} />
          </Field>
          <Field label="Allotted expenses (₹)" htmlFor="p-ax" error={errors.allottedExpenses} hint={v.allottedExpenses ? formatINRShort(Number(v.allottedExpenses)) : "Site expense budget"}>
            <Input id="p-ax" type="number" min={0} step={1000} value={v.allottedExpenses} onChange={(e) => set("allottedExpenses", e.target.value)} aria-invalid={!!errors.allottedExpenses} />
          </Field>
          <Field label="Start date" htmlFor="p-start" required error={errors.startDate}>
            <Input id="p-start" type="date" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} aria-invalid={!!errors.startDate} />
          </Field>
          <Field label="Expected completion" htmlFor="p-end" required error={errors.endDate}>
            <Input id="p-end" type="date" value={v.endDate} onChange={(e) => set("endDate", e.target.value)} aria-invalid={!!errors.endDate} />
          </Field>
          <Field label="Description / scope" htmlFor="p-desc" className="sm:col-span-2">
            <Textarea id="p-desc" rows={4} value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="Scope of work, key equipment, special requirements…" />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
