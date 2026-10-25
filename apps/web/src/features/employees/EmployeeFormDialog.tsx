import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useForm, type Errors } from "@/hooks/useForm";
import { useCreateEmployee, useUpdateEmployee } from "@/hooks/mutations";
import { useAuth } from "@/auth/AuthContext";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/auth/permissions";
import { EMPLOYEE_STATUS } from "@/components/common/StatusBadges";
import { todayISO } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import { USE_API } from "@/api/http";
import { MIN_PASSWORD } from "@/features/auth/ChangePasswordForm";
import type { Department, Employee, EmployeeStatus, Role } from "@/types/models";

const DEPARTMENTS: Department[] = ["Management", "Projects", "Engineering", "Service", "Accounts", "Admin"];

/**
 * What a new person in each department usually needs. Picking the department
 * fills in app access and site work with these; both can still be changed.
 */
const DEPARTMENT_DEFAULTS: Record<Department, { appRole: Role | ""; isSiteEngineer: boolean }> = {
  Management: { appRole: "management", isSiteEngineer: false },
  Projects: { appRole: "project_manager", isSiteEngineer: false },
  Engineering: { appRole: "site_engineer", isSiteEngineer: true },
  Service: { appRole: "", isSiteEngineer: true },
  Accounts: { appRole: "accounts", isSiteEngineer: false },
  Admin: { appRole: "", isSiteEngineer: false },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="col-span-full grid grid-cols-1 gap-4 sm:grid-cols-2">
      <legend className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

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
  /** Live database only: starting password for a new login, or a new one to reset it to. */
  password: string;
};

/** `hasLogin`: the employee already has an active login (so the password field is optional). */
const validate = (v: Values, hasLogin: boolean): Errors<Values> => {
  const e: Errors<Values> = {};
  if (USE_API && v.appRole) {
    if (!hasLogin && !v.password) e.password = "Set a starting password for the new login";
    else if (v.password && v.password.length < MIN_PASSWORD) e.password = `At least ${MIN_PASSWORD} characters`;
  }
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
    isSiteEngineer: e?.isSiteEngineer ?? DEPARTMENT_DEFAULTS.Engineering.isSiteEngineer,
    baseLocation: e?.baseLocation ?? "Pune",
    appRole: e ? (users.find((u) => u.employeeId === e.id)?.role ?? "") : DEPARTMENT_DEFAULTS.Engineering.appRole,
    password: "",
    ...(!e ? defaults : {}),
  });
  const hasLogin = !!employee && users.some((u) => u.employeeId === employee.id);
  const form = useForm<Values>(toValues(employee), useCallback((v: Values) => validate(v, hasLogin), [hasLogin]));
  const { values: v, errors, set } = form;

  // Once someone picks access or site work by hand, a later department change leaves them alone.
  const chosen = useRef({ appRole: false, isSiteEngineer: false });
  useEffect(() => {
    if (open) {
      form.reset(toValues(employee));
      chosen.current = { appRole: !!employee, isSiteEngineer: !!employee };
    }
  }, [open, employee?.id]);

  const setDepartment = (d: Department) => {
    set("department", d);
    if (!chosen.current.appRole) set("appRole", DEPARTMENT_DEFAULTS[d].appRole);
    if (!chosen.current.isSiteEngineer) set("isSiteEngineer", DEPARTMENT_DEFAULTS[d].isSiteEngineer);
  };

  const submit = form.handleSubmit((vals) => {
    const input = {
      ...vals,
      name: vals.name.trim(),
      designation: vals.designation.trim(),
      dailyCost: Number(vals.dailyCost),
      appRole: vals.appRole || null,
      password: vals.password || undefined,
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
        title={employee ? "Edit employee" : defaults?.isSiteEngineer ? "Add site engineer" : "Add employee"}
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
        <form id="employee-form" onSubmit={submit} className="grid grid-cols-1 gap-6" noValidate>
          <Section title="Person">
            <Field label="Full name" htmlFor="e-name" required error={errors.name}>
              <Input id="e-name" value={v.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} autoFocus />
            </Field>
            <Field label="Email" htmlFor="e-email" required error={errors.email} hint={v.appRole ? "They sign in with this" : undefined}>
              <Input id="e-email" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} aria-invalid={!!errors.email} />
            </Field>
            <Field label="Phone" htmlFor="e-phone">
              <Input id="e-phone" value={v.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91" />
            </Field>
            <Field label="Base location" htmlFor="e-loc">
              <Input id="e-loc" value={v.baseLocation} onChange={(e) => set("baseLocation", e.target.value)} />
            </Field>
          </Section>

          <Section title="Job">
            <Field label="Department" htmlFor="e-dept" hint={employee ? undefined : "Fills in app access below"}>
              <Select id="e-dept" value={v.department} onChange={(e) => setDepartment(e.target.value as Department)}>
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
              hint={`${v.dailyCost ? `${formatINR(Number(v.dailyCost))} per man-day · ` : ""}Rate charged to projects, not salary`}
            >
              <Input id="e-sal" type="number" min={0} step={50} value={v.dailyCost} onChange={(e) => set("dailyCost", e.target.value)} aria-invalid={!!errors.dailyCost} placeholder="e.g. 3500" />
            </Field>
            <Field label="Joining date" htmlFor="e-join" required error={errors.joiningDate}>
              <Input id="e-join" type="date" value={v.joiningDate} onChange={(e) => set("joiningDate", e.target.value)} />
            </Field>
            {employee && (
              <>
                <Field label="Employee ID" htmlFor="e-code">
                  <Input id="e-code" value={v.code} onChange={(e) => set("code", e.target.value)} />
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
              </>
            )}
            <label className="col-span-full flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={v.isSiteEngineer}
                onChange={(e) => {
                  chosen.current.isSiteEngineer = true;
                  set("isSiteEngineer", e.target.checked);
                }}
              />
              <span>
                Works on project sites
                <span className="block text-xs text-muted-foreground">Can be put on a project team and marked in daily attendance.</span>
              </span>
            </label>
          </Section>

          <Section title="App access">
            <Field
              label="Can sign in as"
              htmlFor="e-role"
              className="col-span-full"
              hint={v.appRole ? ROLE_DESCRIPTIONS[v.appRole] : USE_API && hasLogin ? "Their login will be switched off." : "No login. They still appear in lists, teams and attendance."}
            >
              <Select
                id="e-role"
                value={v.appRole}
                onChange={(e) => {
                  chosen.current.appRole = true;
                  set("appRole", e.target.value as Role | "");
                }}
              >
                <option value="">No login</option>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
            {USE_API && v.appRole && (
              <Field
                label={hasLogin ? "Reset password" : "Starting password"}
                htmlFor="e-pass"
                className="col-span-full"
                required={!hasLogin}
                error={errors.password}
                hint={hasLogin ? "Leave blank to keep their password. A new one must be changed at next sign-in." : "Share it with them; they choose their own at first sign-in."}
              >
                <Input id="e-pass" type="text" autoComplete="off" value={v.password} onChange={(e) => set("password", e.target.value)} aria-invalid={!!errors.password} />
              </Field>
            )}
          </Section>
        </form>
      </DialogContent>
    </Dialog>
  );
}
