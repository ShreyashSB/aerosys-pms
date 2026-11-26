import { useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import { serverSlow } from "@/api/http";

/**
 * Shown on every screen while a request has been waiting more than a few seconds, which almost always means the
 * free server is waking up after a quiet spell. Without it, the app looks hung for up to a minute.
 */
export function ServerWakeNotice() {
  const slow = useSyncExternalStore(serverSlow.subscribe, serverSlow.get);
  // The start-up screen says this itself, in the middle of the screen.
  if (!slow || document.querySelector("[data-boot]")) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-20 z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-lg border bg-surface px-4 py-3 text-sm shadow-lg md:bottom-6"
    >
      <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
      <span>
        <span className="font-medium">Starting up the server.</span>{" "}
        <span className="text-muted-foreground">After a quiet spell this can take up to a minute.</span>
      </span>
    </div>
  );
}
