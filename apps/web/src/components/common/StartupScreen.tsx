import { useSyncExternalStore } from "react";
import { serverSlow } from "@/api/http";

/**
 * The same start-up screen that index.html paints before the app's code arrives (its styles live there, in the
 * "boot" classes), shown while the app loads its first page and checks who is signed in. Keeping one screen from
 * the first paint until the app is ready means a phone never shows a blank page in between.
 *
 * When the server is slow to answer (the free host waking up after a quiet spell), the message says so here, and
 * the floating ServerWakeNotice stays hidden so the same thing isn't said twice.
 */
export function StartupScreen({ message = "Opening the app…" }: { message?: string }) {
  const slow = useSyncExternalStore(serverSlow.subscribe, serverSlow.get);
  return (
    <div className="boot" role="status" aria-live="polite" data-boot>
      <svg className="boot-logo" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="7" fill="#0b5cab" />
        <path
          d="M16 7c2.5 0 3.2 3.4 1.6 5.6 3.1-.8 7.4.6 7.4 3.4 0 2.5-3.4 3.2-5.6 1.6.8 3.1-.6 7.4-3.4 7.4-2.5 0-3.2-3.4-1.6-5.6-3.1.8-7.4-.6-7.4-3.4 0-2.5 3.4-3.2 5.6-1.6C11.8 11.3 13.2 7 16 7z"
          fill="#fff"
        />
        <circle cx="16" cy="16" r="2" fill="#0b5cab" />
      </svg>
      <p className="boot-name">AEROSYS</p>
      <div className="boot-spin" />
      <p className="boot-msg">
        {slow ? "Starting up the server. After a quiet spell this can take up to a minute." : message}
      </p>
    </div>
  );
}
