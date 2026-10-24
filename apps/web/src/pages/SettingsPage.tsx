import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Database, RotateCcw, Shield } from "lucide-react";
import { useAuth, useCurrentUser } from "@/auth/AuthContext";
import { can, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/auth/permissions";
import { useSettings } from "@/hooks/queries";
import { useResetDemoData, useUpdateSettings } from "@/hooks/mutations";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { PROJECTION_LABEL } from "@/domain/assumptions";
import { Skeleton } from "@/components/ui/misc";
import type { AppSettings, ProjectionMethod, Role } from "@/types/models";

export function SettingsPage() {
  const { user, employee } = useCurrentUser();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();
  const reset = useResetDemoData();
  const [confirmReset, setConfirmReset] = useState(false);
  type Form = Record<Exclude<keyof AppSettings, "projectionMethod">, string> & { projectionMethod: ProjectionMethod };
  const [form, setForm] = useState<Form | null>(null);
  const editable = can(user.role, "settings.manage");

  useEffect(() => {
    if (settings)
      setForm({
        companyName: settings.companyName,
        hoursPerManDay: String(settings.hoursPerManDay),
        overheadPctOfWages: String(settings.overheadPctOfWages),
        managementPctOfEarnedValue: String(settings.managementPctOfEarnedValue),
        instrumentMonthlyRatePct: String(settings.instrumentMonthlyRatePct),
        projectionMethod: settings.projectionMethod,
        targetMarginPct: String(settings.targetMarginPct),
        deadlineAlertDays: String(settings.deadlineAlertDays),
      });
  }, [settings]);

  const setF = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const range = (v: string | undefined, min: number, max: number) => {
    const n = Number(v);
    return v !== "" && n >= min && n <= max ? undefined : `${min}–${max}`;
  };
  const errs: Partial<Record<keyof Form, string>> = form
    ? {
        companyName: form.companyName.trim() ? undefined : "Required",
        hoursPerManDay: range(form.hoursPerManDay, 1, 24),
        overheadPctOfWages: range(form.overheadPctOfWages, 0, 100),
        managementPctOfEarnedValue: range(form.managementPctOfEarnedValue, 0, 50),
        instrumentMonthlyRatePct: range(form.instrumentMonthlyRatePct, 0, 20),
        targetMarginPct: range(form.targetMarginPct, 0, 100),
        deadlineAlertDays: range(form.deadlineAlertDays, 1, 90),
      }
    : {};
  const invalid = Object.values(errs).some(Boolean);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Settings" }]} />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Signed in as {employee.name}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">Designation</p><p className="font-medium">{employee.designation}</p></div>
            <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium">{user.email}</p></div>
            <div><p className="text-xs text-muted-foreground">Role</p><p className="font-medium">{ROLE_LABELS[user.role]}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Costing & performance assumptions</CardTitle>
              <CardDescription>
                {editable
                  ? "Demo assumptions pending confirmation by Aerosys. Changing them recalculates every project, KPI and report immediately."
                  : "Only management can change these settings."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading || !form ? (
              <Skeleton className="h-40" />
            ) : (
              <form
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (invalid) return;
                  update.mutate(
                    {
                      companyName: form.companyName.trim(),
                      hoursPerManDay: Number(form.hoursPerManDay),
                      overheadPctOfWages: Number(form.overheadPctOfWages),
                      managementPctOfEarnedValue: Number(form.managementPctOfEarnedValue),
                      instrumentMonthlyRatePct: Number(form.instrumentMonthlyRatePct),
                      projectionMethod: form.projectionMethod,
                      targetMarginPct: Number(form.targetMarginPct),
                      deadlineAlertDays: Number(form.deadlineAlertDays),
                    },
                    { onSuccess: () => toast.success("Settings saved", { description: "All project performance figures recalculated." }) },
                  );
                }}
              >
                <Field label="Company name" htmlFor="s-name" error={errs.companyName}>
                  <Input id="s-name" value={form.companyName} disabled={!editable} onChange={(e) => setF("companyName", e.target.value)} />
                </Field>
                <Field label="Working hours per man-day" htmlFor="s-hours" error={errs.hoursPerManDay} hint="Converts idle man-hours into idle man-days">
                  <Input id="s-hours" type="number" min={1} max={24} step={0.5} value={form.hoursPerManDay} disabled={!editable} onChange={(e) => setF("hoursPerManDay", e.target.value)} />
                </Field>
                <Field label="Overhead (% of wages)" htmlFor="s-oh" error={errs.overheadPctOfWages} hint="Demo assumption for overhead cost">
                  <Input id="s-oh" type="number" min={0} max={100} step={0.5} value={form.overheadPctOfWages} disabled={!editable} onChange={(e) => setF("overheadPctOfWages", e.target.value)} />
                </Field>
                <Field label="Management charges (% of earned value)" htmlFor="s-mg" error={errs.managementPctOfEarnedValue} hint="Demo assumption for management cost">
                  <Input id="s-mg" type="number" min={0} max={50} step={0.5} value={form.managementPctOfEarnedValue} disabled={!editable} onChange={(e) => setF("managementPctOfEarnedValue", e.target.value)} />
                </Field>
                <Field label="Instrument usage rate (% of value / month)" htmlFor="s-rate" error={errs.instrumentMonthlyRatePct} hint="Charged to projects while deployed">
                  <Input id="s-rate" type="number" step={0.5} min={0} max={20} value={form.instrumentMonthlyRatePct} disabled={!editable} onChange={(e) => setF("instrumentMonthlyRatePct", e.target.value)} />
                </Field>
                <Field label="Projected cost method" htmlFor="s-proj" hint={PROJECTION_LABEL[form.projectionMethod]}>
                  <Select id="s-proj" value={form.projectionMethod} disabled={!editable} onChange={(e) => setF("projectionMethod", e.target.value as ProjectionMethod)}>
                    <option value="performance">Performance-based (cost ÷ progress)</option>
                    <option value="budget">Budget-based (cost + remaining budget)</option>
                  </Select>
                </Field>
                <Field label="Target profit margin (%)" htmlFor="s-margin" error={errs.targetMarginPct} hint="Projected margin below this is flagged amber">
                  <Input id="s-margin" type="number" min={0} max={100} step={0.5} value={form.targetMarginPct} disabled={!editable} onChange={(e) => setF("targetMarginPct", e.target.value)} />
                </Field>
                <Field label="Deadline alert (days before)" htmlFor="s-days" error={errs.deadlineAlertDays}>
                  <Input id="s-days" type="number" min={1} max={90} value={form.deadlineAlertDays} disabled={!editable} onChange={(e) => setF("deadlineAlertDays", e.target.value)} />
                </Field>
                <div className="rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
                  <p className="mb-1 font-medium text-foreground">Formulas in use (defined once in src/domain/assumptions.ts)</p>
                  <ul className="list-disc space-y-0.5 pl-4">
                    <li>PPI = Work Order Value ÷ Allotted Man-Days (working hypothesis)</li>
                    <li>Progress = Executed BOQ Value ÷ Total BOQ Value; Earned Value = Work Order Value × Progress</li>
                    <li>Running PPI = Earned Value ÷ Consumed Man-Days</li>
                    <li>Wages = Consumed Man-Days × employee Daily Cost; Idle Days = Σ idle person-days</li>
                    <li>Cost to date = Wages + Approved Expenses + Overhead + Instrument + Management (+ other direct costs)</li>
                  </ul>
                </div>
                {editable && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Button type="submit" loading={update.isPending} disabled={invalid}>Save settings</Button>
                  </div>
                )}
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2"><Shield className="size-4" /> Roles & access</CardTitle>
              <CardDescription>What each role can see and do in this prototype</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <div key={r} className="rounded-md border p-3">
                <p className="text-sm font-medium">{ROLE_LABELS[r]}{r === user.role && <span className="ml-2 text-xs text-primary">(you)</span>}</p>
                <p className="mt-1 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2"><Database className="size-4" /> Demo data</CardTitle>
              <CardDescription>All data is stored locally in this browser (localStorage) and survives refreshes. Reset to restore the original sample dataset.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="text-danger" onClick={() => setConfirmReset(true)}>
              <RotateCcw /> Reset demo data
            </Button>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset all demo data?"
        description="All projects, expenses, assignments, instruments and notifications you created will be replaced by the original sample data."
        confirmLabel="Reset data"
        destructive
        loading={reset.isPending}
        onConfirm={() =>
          reset.mutate(undefined, {
            onSuccess: () => {
              toast.success("Demo data restored");
              setConfirmReset(false);
              logout();
              navigate("/login");
            },
          })
        }
      />
    </div>
  );
}
