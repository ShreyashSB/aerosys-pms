import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

/** Same rule as the API (`PASSWORD_RULE` in apps/api/src/auth/password.ts). */
export const MIN_PASSWORD = 8;

/** Current password, new password, and the new one again. Used at first sign-in and in Settings. */
export function ChangePasswordForm({ submitLabel = "Change password", onDone }: { submitLabel?: string; onDone?: () => void }) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errs = {
    current: current ? undefined : "Enter your current password",
    next: next.length < MIN_PASSWORD ? `At least ${MIN_PASSWORD} characters` : next === current ? "Pick a password different from the current one" : undefined,
    again: again === next ? undefined : "The two passwords don't match",
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (errs.current || errs.next || errs.again) return;
    setSaving(true);
    setError(null);
    try {
      await changePassword(current, next);
      toast.success("Password changed");
      setCurrent("");
      setNext("");
      setAgain("");
      setTried(false);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change the password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Current password" htmlFor="pw-current" error={tried ? errs.current : undefined}>
        <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="New password" htmlFor="pw-new" hint={`At least ${MIN_PASSWORD} characters`} error={tried ? errs.next : undefined}>
        <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <Field label="New password again" htmlFor="pw-again" error={tried ? errs.again : undefined}>
        <Input id="pw-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
      </Field>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" loading={saving} className="w-full sm:w-auto">{submitLabel}</Button>
    </form>
  );
}
