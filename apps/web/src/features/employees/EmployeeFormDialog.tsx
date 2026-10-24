import { useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useForm, type Errors } from "@/hooks/useForm";
import { useCreateEmployee, useUpdateEmployee } from "@/hooks/mutations";
import { useAuth } from "@/auth/AuthContext";
import { ROLE_LABELS } from "@/auth/permissions";
import { EMPLOYEE_STATUS } from "@/components/common/StatusBadges";
import { todayISO } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import type { Department, Employee, EmployeeStatus, Role } from "@/types/models";

const DEPARTMENTS: Department[] = ["Management", "Projects", "Engineering", "Service", "Accounts", "Admin"];

type Values = {
  code: string;
  name: string;
  email: string;
  phone: string;
  department: Department;
  designation: string;
  dailyCost: string;
  joiningDate: string;
  status: EmployeeStatus;
  isSiteEngineer: boolean;
  baseLocation: string;
  appRole: Role | "";
};

const validate = (v: Values): Errors<Values> => {
  const e: Errors<Values> = {};
  if (!v.name.trim()) e.name = "Name is required";
  if (!/^\S+@\S+\.\S+$/.test(v.email)) e.email = "Enter a valid email";
  if (!v.designation.trim()) e.designation = "Designation is required";
  if (v.dailyCost === "" || !(Number(v.dailyCost) >= 0)) e.dailyCost = "Enter the daily cost rate";
  if (!v.joiningDate) e.joiningDate = "Joining date is required";
  return e;
};

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  defaults,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employee?: Employee;
  defaults?: Partial<Values>;
}) {
  const { users } = useAuth();
  const create = useCreateEmployee();
  const update = useUpdateEmployee();
  const toValues = (e?: Employee): Values => ({
    code: e?.code ?? "",
    name: e?.name ?? "",
    email: e?.email ?? "",
    phone: e?.phone ?? "",
    department: e?.department ?? "Engineering",
    designation: e?.designation ?? "",
    dailyCost: e ? String(e.dailyCost) : "",
    joiningDate: e?.joiningDate ?? todayISO(),
    status: e?.status ?? "active",
    isSiteEngineer: e?.isSiteEngineer ?? false,
    baseLocation: e?.baseLocation ?? "Pune",
    appRole: (e && users.find((u) => u.employeeId === e.id)?.role) || "",
    ...(!e ? defaults : {}),
  });
  const form = useForm<Values>(toValues(employee), validate);
  const { values: v, errors, set } = form;

  useEffect(() => {
    if (open) form.reset(toValues(employee));
  }, [open, employee?.id]);

  const submit = form.handleSubmit((vals) => {
    const input = {
      ...vals,
      name: vals.name.trim(),
      designation: vals.designation.trim(),
      dailyCost: Number(vals.dailyCost),
      appRole: vals.appRole || null,
    };
    const done = (msg: string) => () => {
      toast.success(msg, { description: input.name });
      onOpenChange(false);
    };
    if (employee) update.mutate({ id: employee.id, input }, { onSuccess: done("Employee updated") });
    else create.mutate(input, { onSuccess: done("Employee added") });
  });

  const pending = create.isPending || update.isPending;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        side="right"
        title={employee ? "Edit employee" : v.isSiteEngineer ? "Add site engineer" : "Add employee"}
        description={employee?.code}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form="employee-form" loading={pending}>
              {employee ? "Save changes" : "Add employee"}
            </Button>
          </>
        }
      >
        <form id="employee-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Full name" htmlFor="e-name" required error={errors.name}>
            <Input id="e-name" value={v.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} autoFocus />
          </Field>
          <Field label="Employee ID" htmlFor="e-code" hint={employee ? undefined : "Auto-generated if blank"}>
            <Input id="e-code" value={v.code} onChange={(e) => set("code", e.target.value)} placeholder="AHV-1XX" />
          </Field>
          <Field label="Email" htmlFor="e-email" required error={errors.email}>
            <Input id="e-email" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} aria-invalid={!!errors.email} />
          </Field>
          <Field label="Phone" htmlFor="e-phone">
            <Input id="e-phone" value={v.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91" />
          </Field>
          <Field label="Department" htmlFor="e-dept">
            <Select id="e-dept" value={v.department} onChange={(e) => set("department", e.target.value as Department)}>
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </Field>
          <Field label="Designation" htmlFor="e-desig" required error={errors.designation}>
            <Input id="e-desig" value={v.designation} onChange={(e) => set("designation", e.target.value)} placeholder="e.g. Site Engineer" aria-invalid={!!errors.designation} />
          </Field>
          <Field
            label="Daily cost (₹ / day)"
            htmlFor="e-sal"
            required
            error={errors.dailyCost}
            hint={`${v.dailyCost ? `${formatINR(Number(v.dailyCost))} per man-day · ` : ""}Internal project costing rate – not salary or CTC`}
          >
            <Input id="e-sal" type="number" min={0} step={50} value={v.dailyCost} onChange={(e) => set("dailyCost", e.target.value)} aria-invalid={!!errors.dailyCost} placeholder="e.g. 3500" />
          </Field>
          <Field label="Joining date" htmlFor="e-join" required error={errors.joiningDate}>
            <Input id="e-join" type="date" value={v.joiningDate} onChange={(e) => set("joiningDate", e.target.value)} />
          </Field>
          <Field label="Base location" htmlFor="e-loc">
            <Input id="e-loc" value={v.baseLocation} onChange={(e) => set("baseLocation", e.target.value)} />
          </Field>
          <Field label="Status" htmlFor="e-status">
            <Select id="e-status" value={v.status} onChange={(e) => set("status", e.target.value as EmployeeStatus)}>
              {(Object.keys(EMPLOYEE_STATUS) as EmployeeStatus[]).map((s) => (
                <option key={s} value={s}>
                  {EMPLOYEE_STATUS[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="System access" htmlFor="e-role" hint="Grants a login with this role">
            <Select id="e-role" value={v.appRole} onChange={(e) => set("appRole", e.target.value as Role | "")}>
              <option value="">No login</option>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={v.isSiteEngineer} onChange={(e) => set("isSiteEngineer", e.target.checked)} />
            Deployable site engineer / technician
          </label>
        </form>
      </DialogContent>
    </Dialog>
  );
}
