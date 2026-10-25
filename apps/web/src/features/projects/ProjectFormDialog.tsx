import { useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useForm, type Errors } from "@/hooks/useForm";
import { useCreateProject, useUpdateProject } from "@/hooks/mutations";
import { useAppData } from "@/hooks/useAppData";
import { useLookups } from "@/hooks/queries";
import { CreatableSelect } from "@/components/common/CreatableSelect";
import { useAuth } from "@/auth/AuthContext";
import { PROJECT_STATUS } from "@/components/common/StatusBadges";
import { addDays, todayISO } from "@/lib/dates";
import { formatINR, formatINRShort, formatPerMd } from "@/lib/format";
import { ppi } from "@/domain/assumptions";
import type { Project, ProjectStatus } from "@/types/models";

type Values = {
  code: string;
  name: string;
  clientName: string;
  site: string;
  projectType: string;
  workOrderNo: string;
  poNo: string;
  operationalCostPerManDay: string;
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
    code: p?.code ?? "",
    name: p?.name ?? "",
    clientName: p?.clientName ?? "",
    site: p?.site ?? "",
    projectType: p?.projectType ?? "",
    workOrderNo: p?.workOrderNo ?? "",
    poNo: p?.poNo ?? "",
    operationalCostPerManDay: p ? String(p.operationalCostPerManDay) : "150",
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
  if (!v.projectType.trim()) e.projectType = "Select a project type";
  if (v.code.trim() && !/^[A-Za-z0-9/_-]+$/.test(v.code.trim())) e.code = "Use letters, numbers, - / or _ only";
  if (v.operationalCostPerManDay !== "" && !(Number(v.operationalCostPerManDay) >= 0)) e.operationalCostPerManDay = "Enter a valid amount";
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
  const lookups = useLookups().data;
  const clients = lookups?.clients ?? [];
  const sites = lookups?.sites ?? [];
  const types = lookups?.projectTypes ?? [];
  const nextCode = `PRJ-${new Date().getFullYear()}-${String(Math.max(0, ...projects.map((p) => Number(p.code.split("-").pop()) || 0)) + 1).padStart(3, "0")}`;
  const lockManager = user?.role === "project_manager";

  const submit = form.handleSubmit((vals) => {
    const input = {
      code: vals.code.trim() || undefined,
      name: vals.name.trim(),
      clientName: vals.clientName.trim(),
      site: vals.site.trim(),
      projectType: vals.projectType.trim(),
      workOrderNo: vals.workOrderNo.trim(),
      poNo: vals.poNo.trim(),
      operationalCostPerManDay: vals.operationalCostPerManDay ? Number(vals.operationalCostPerManDay) : 0,
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
            // Closing a project prompts the PM to review the team.
            if (project.status !== "completed" && input.status === "completed") navigate(`/projects/${project.id}?review=1`);
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
          <Field label="Project ID" htmlFor="p-code" error={errors.code} hint={project ? undefined : `Leave blank for ${nextCode}`}>
            <Input id="p-code" value={v.code} onChange={(e) => set("code", e.target.value)} placeholder={nextCode} aria-invalid={!!errors.code} />
          </Field>
          <Field label="Project type" htmlFor="p-type" required error={errors.projectType}>
            <CreatableSelect id="p-type" value={v.projectType} onChange={(x) => set("projectType", x)} options={types} placeholder="Select type…" addLabel="Add new type…" newPlaceholder="e.g. Retro-commissioning" invalid={!!errors.projectType} />
          </Field>
          <Field label="Client" htmlFor="p-client" required error={errors.clientName}>
            <CreatableSelect id="p-client" value={v.clientName} onChange={(x) => set("clientName", x)} options={clients} placeholder="Select client…" addLabel="Add new client…" newPlaceholder="Client company name" invalid={!!errors.clientName} />
          </Field>
          <Field label="Site / location" htmlFor="p-site" required error={errors.site}>
            <CreatableSelect id="p-site" value={v.site} onChange={(x) => set("site", x)} options={sites} placeholder="Select location…" addLabel="Add new location…" newPlaceholder="e.g. Hinjewadi, Pune" invalid={!!errors.site} />
          </Field>
          <Field label="Client work order no." htmlFor="p-wo" hint="As on the annexure">
            <Input id="p-wo" value={v.workOrderNo} onChange={(e) => set("workOrderNo", e.target.value)} placeholder="e.g. WO/PMD/2026/041" />
          </Field>
          <Field label="Client PO no." htmlFor="p-po">
            <Input id="p-po" value={v.poNo} onChange={(e) => set("poNo", e.target.value)} placeholder="e.g. PO-450012" />
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
          <Field
            label="Operational cost per man-day (₹)"
            htmlFor="p-op"
            error={errors.operationalCostPerManDay}
            hint={`Charged for each man-day logged on the project${Number(v.operationalCostPerManDay) > 0 ? ` · ${formatINR(Number(v.operationalCostPerManDay))} / man-day` : ""}`}
          >
            <Input id="p-op" type="number" min={0} step={10} value={v.operationalCostPerManDay} onChange={(e) => set("operationalCostPerManDay", e.target.value)} aria-invalid={!!errors.operationalCostPerManDay} />
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
