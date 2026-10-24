import { LogOut } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/Logo";
import { ChangePasswordForm } from "./ChangePasswordForm";

/**
 * Shown instead of the app after signing in with a starting password (a new
 * login, or one management reset). The server refuses everything else until
 * the password is changed, so this is the only thing to do.
 */
export function FirstPasswordScreen() {
  const { logout } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        <Logo />
        <div>
          <h1 className="text-2xl font-semibold">Choose your own password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You signed in with a starting password from management. Pick a new one that only you know. Use the starting password as the current one.
          </p>
        </div>
        <ChangePasswordForm submitLabel="Save and continue" />
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut /> Sign out
        </Button>
      </div>
    </div>
  );
}
