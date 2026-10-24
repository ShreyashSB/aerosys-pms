import { useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useForm, type Errors } from "@/hooks/useForm";
import { useAssignEngineer } from "@/hooks/mutations";
import { useAppData } from "@/hooks/useAppData";
import { todayISO } from "@/lib/dates";
import type { ProjectAssignment } from "@/types/models";

type Values = { employeeId: string; role: ProjectAssignment["role"]; allocation: string; startDate: string; projectId: string };
const ROLES: ProjectAssignment["role"][] = ["Site Engineer", "Lead Engineer", "Technician", "Supervisor"];

/**
 * Assign an engineer to a project. Pass `projectId` to lock the project
 * (project page) or `employeeId` to lock the engineer (engineer page).
 */
export function AssignEngineerDialog({
  open,
  onOpenChange,
  projectId,
  employeeId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId?: string;
  employeeId?: string;
}) {
  const { employees, assignments, projects, projectById } = useAppData();
  const assign = useAssignEngineer();
  const initial: Values = { employeeId: employeeId ?? "", role: "Site Engineer", allocation: "100", startDate: todayISO(), projectId: projectId ?? "" };
  const form = useForm<Values>(initial, (v) => {
    const e: Errors<Values> = {};
    if (!v.projectId) e.projectId = "Select a project";
    if (!v.employeeId) e.employeeId = "Select an engineer";
    const a = Number(v.allocation);
    if (!(a > 0 && a <= 100)) e.allocation = "Enter 1–100";
    if (!v.startDate) e.startDate = "Start date is required";
    return e;
  });
  const { values: v, errors, set } = form;

  useEffect(() => {
    if (open) form.reset(initial);
  }, [open, projectId, employeeId]);

  const activeLoad = (empId: string) =>
    assignments.filter((a) => a.employeeId === empId && !a.endDate).reduce((s, a) => s + a.allocation, 0);
  const alreadyOn = new Set(assignments.filter((a) => a.projectId === v.projectId && !a.endDate).map((a) => a.employeeId));
  const engineers = employees.filter((e) => e.isSiteEngineer && e.status !== "inactive" && !alreadyOn.has(e.id));
  const openProjects = projects.filter((p) => p.status === "active" || p.status === "planning" || p.status === "on_hold");
  const load = v.employeeId ? activeLoad(v.employeeId) : 0;
  const selected = employees.find((e) => e.id === v.employeeId);

  const submit = form.handleSubmit((vals) => {
    assign.mutate(
      { projectId: vals.projectId, employeeId: vals.employeeId, role: vals.role, allocation: Number(vals.allocation), startDate: vals.startDate },
      {
        onSuccess: () => {
          toast.success("Engineer assigned", { description: `${selected?.name} → ${projectById.get(vals.projectId)?.name}` });
          onOpenChange(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Assign engineer"
        description={projectId ? projectById.get(projectId)?.name : "Add this engineer to a project team"}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" form="assign-eng-form" loading={assign.isPending}>
              Assign
            </Button>
          </>
        }
      >
        <form id="assign-eng-form" onSubmit={submit} className="grid grid-cols-2 gap-4" noValidate>
          <Field label="Project" htmlFor="ae-prj" required error={errors.projectId} className="col-span-2">
            <Select id="ae-prj" value={v.projectId} onChange={(e) => set("projectId", e.target.value)} disabled={!!projectId} aria-invalid={!!errors.projectId}>
              <option value="">Select project…</option>
              {(projectId ? projects.filter((p) => p.id === projectId) : openProjects).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Engineer" htmlFor="ae-emp" required error={errors.employeeId} className="col-span-2">
            <Select id="ae-emp" value={v.employeeId} onChange={(e) => set("employeeId", e.target.value)} disabled={!!employeeId} aria-invalid={!!errors.employeeId}>
              <option value="">Select engineer…</option>
              {(employeeId ? employees.filter((e) => e.id === employeeId) : engineers).map((e) => {
                const l = activeLoad(e.id);
                return (
                  <option key={e.id} value={e.id}>
                    {e.name} — {e.designation} · {l === 0 ? "Available" : `${l}% allocated`}
                    {e.status === "on_leave" ? " (on leave)" : ""}
                  </option>
                );
              })}
            </Select>
          </Field>
          <Field label="Role on project" htmlFor="ae-role">
            <Select id="ae-role" value={v.role} onChange={(e) => set("role", e.target.value as Values["role"])}>
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label="Allocation %" htmlFor="ae-alloc" required error={errors.allocation} hint="Planned share of time – used for availability">
            <Input id="ae-alloc" type="number" min={1} max={100} value={v.allocation} onChange={(e) => set("allocation", e.target.value)} aria-invalid={!!errors.allocation} />
          </Field>
          <Field label="Start date" htmlFor="ae-start" required error={errors.startDate}>
            <Input id="ae-start" type="date" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </Field>
          {selected && load + Number(v.allocation || 0) > 100 && (
            <p className="col-span-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
              {selected.name} is already {load}% allocated. This assignment would take them to {load + Number(v.allocation)}%.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
