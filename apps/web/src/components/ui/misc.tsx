import type { HTMLAttributes, ReactNode } from "react";
import { cn, initials } from "@/lib/utils";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export function Progress({ value, className, tone }: { value: number; className?: string; tone?: "primary" | "success" | "warning" }) {
  const color = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-primary";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

const AVATAR_TONES = [
  "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200",
  "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
];

export function Avatar({ name, className }: { name: string; className?: string }) {
  const tone = AVATAR_TONES[name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", tone, className)} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{children}</kbd>;
}
