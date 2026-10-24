import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Building2, Calculator, HardHat, Loader2, LogIn, Briefcase } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { USE_API } from "@/api/http";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/auth/permissions";
import { useEmployees } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/models";

const ROLE_ICONS: Record<Role, typeof Building2> = {
  management: Building2,
  project_manager: Briefcase,
  site_engineer: HardHat,
  accounts: Calculator,
};
const ROLES: Role[] = ["management", "project_manager", "site_engineer", "accounts"];

export function LoginPage() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-white lg:flex">
        <Logo light />
        <div className="relative z-10 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">Every HVAC project, cost and engineer — in one place.</h1>
          <p className="mt-4 text-sidebar-foreground">
            Track project progress, site engineer deployment, expenses, instruments and profitability across all Aerosys HVAC sites.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-sidebar-foreground">
            {["Live project costing & profit margins", "Expenses, bills and invoices that update project cost instantly", "Engineer & instrument deployment tracking"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-sky-400" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-sidebar-foreground/60">
          {USE_API ? "Accounts are created by management" : "Phase 1 prototype · demo data stored locally in your browser"}
        </p>
        <svg className="absolute -right-24 -top-24 size-[28rem] text-white/[0.03]" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="48" fill="currentColor" />
        </svg>
      </div>

      <div className="flex items-center justify-center p-4 sm:p-6">{USE_API ? <PasswordLogin /> : <DemoLogin />}</div>
    </div>
  );
}

/** Live database: work email and password, checked by the server. */
function PasswordLogin() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }
    setSubmitting(true);
    setError(null);
    // The free server sleeps when nobody has used it for a while; say so if waking it takes a moment.
    const timer = setTimeout(() => setSlow(true), 4000);
    try {
      await signIn(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in");
      setSubmitting(false);
    } finally {
      clearTimeout(timer);
      setSlow(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-md space-y-6" noValidate>
      <div className="lg:hidden">
        <Logo />
      </div>
      <div>
        <h2 className="text-2xl font-semibold">Sign in</h2>
        <p className="mt-1 text-sm text-muted-foreground">Use your work email and the password management gave you.</p>
      </div>
      <Field label="Email" htmlFor="login-email">
        <Input id="login-email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@aerosyshvac.in" />
      </Field>
      <Field label="Password" htmlFor="login-pass">
        <Input id="login-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" size="lg" loading={submitting}>
        {!submitting && <LogIn />} Sign in
      </Button>
      {slow && <p className="text-center text-xs text-muted-foreground">Waking the server up. The first sign-in after a quiet spell can take up to a minute.</p>}
      <p className="text-xs text-muted-foreground">Forgot your password? Ask management to reset it from the Employees page.</p>
    </form>
  );
}

/** Demo data: pick a role and a person, any password works. */
function DemoLogin() {
  const { users, login, loading } = useAuth();
  const { data: employees = [] } = useEmployees();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<Role>("management");
  const [submitting, setSubmitting] = useState(false);

  const roleUsers = users.filter((u) => u.role === role);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = roleUsers.find((u) => u.id === selectedId) ?? roleUsers[0];
  const nameOf = (id: string) => employees.find((e) => e.id === id);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setTimeout(() => {
      login(selected.id);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : "/", { replace: true });
    }, 450);
  };

  return (
    <form onSubmit={submit} className="w-full max-w-md space-y-6">
      <div className="lg:hidden">
        <Logo />
      </div>
      <div>
        <h2 className="text-2xl font-semibold">Sign in</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose a demo role to explore the system.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ROLES.map((r) => {
          const Icon = ROLE_ICONS[r];
          return (
            <button
              type="button"
              key={r}
              onClick={() => {
                setRole(r);
                setSelectedId(null);
              }}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors cursor-pointer",
                role === r ? "border-primary bg-primary-soft ring-1 ring-primary" : "bg-surface hover:bg-muted",
              )}
            >
              <Icon className={cn("mb-1.5 size-5", role === r ? "text-primary" : "text-muted-foreground")} />
              <p className="text-sm font-medium">{ROLE_LABELS[r]}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</p>
            </button>
          );
        })}
      </div>

      <Field label="User" htmlFor="login-user">
        {loading ? (
          <div className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading users…
          </div>
        ) : (
          <select
            id="login-user"
            value={selected?.id ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-surface px-3 text-sm"
          >
            {roleUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {nameOf(u.employeeId)?.name} — {nameOf(u.employeeId)?.designation}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Email" htmlFor="login-email">
        <Input id="login-email" value={selected?.email ?? ""} readOnly />
      </Field>
      <Field label="Password" htmlFor="login-pass" hint="Any password works in the demo">
        <Input id="login-pass" type="password" defaultValue="demo1234" />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={submitting} disabled={!selected}>
        {!submitting && <LogIn />} Sign in as {ROLE_LABELS[role]}
      </Button>
    </form>
  );
}
