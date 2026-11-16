import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const RELOAD_KEY = "aerosys.reloadedForUpdate";

/** A page file that no longer exists on the server: the app was updated while this tab was open. */
function isStaleBuild(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch dynamically/i.test(msg);
}

/**
 * Reloads once to pick up the new version of the app. Remembers the reload for a minute, so a page that is really
 * missing shows the error screen instead of reloading forever.
 */
export function reloadForUpdate(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // No storage: still reload once; the worst case is one extra reload.
  }
  window.location.reload();
  return true;
}

/**
 * Catches anything that goes wrong while drawing a page, so the person sees a message and a way out instead of a
 * blank white screen. `compact` is for the page area inside the app shell, where the menus keep working.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode; compact?: boolean }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isStaleBuild(error) && reloadForUpdate()) return;
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const stale = isStaleBuild(this.state.error);
    return (
      <div className={this.props.compact ? "py-10" : "flex min-h-screen items-center justify-center p-6"}>
        <div className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft px-6 py-10 text-center">
          <AlertTriangle className="size-6 text-danger" />
          <p className="text-sm font-medium text-danger">{stale ? "The app has been updated" : "Something went wrong on this page"}</p>
          <p className="text-sm text-muted-foreground">
            {stale ? "Reload to get the latest version." : "Reloading usually fixes it. If it keeps happening, tell the person who looks after the app what you were doing."}
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }
}
