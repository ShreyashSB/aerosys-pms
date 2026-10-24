import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="7" fill="#0b5cab" />
      <path
        d="M16 7c2.5 0 3.2 3.4 1.6 5.6 3.1-.8 7.4.6 7.4 3.4 0 2.5-3.4 3.2-5.6 1.6.8 3.1-.6 7.4-3.4 7.4-2.5 0-3.2-3.4-1.6-5.6-3.1.8-7.4-.6-7.4-3.4 0-2.5 3.4-3.2 5.6-1.6C11.8 11.3 13.2 7 16 7z"
        fill="#fff"
      />
      <circle cx="16" cy="16" r="2" fill="#0b5cab" />
    </svg>
  );
}

export function Logo({ collapsed, light }: { collapsed?: boolean; light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed && (
        <div className="leading-tight">
          <p className={cn("text-sm font-bold tracking-wide", light ? "text-white" : "text-foreground")}>AEROSYS HVAC</p>
          <p className={cn("text-[10px] uppercase tracking-wider", light ? "text-sidebar-foreground/70" : "text-muted-foreground")}>
            Projects & Operations
          </p>
        </div>
      )}
    </div>
  );
}
