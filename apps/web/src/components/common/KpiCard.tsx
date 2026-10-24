import type { ReactNode } from "react";
import { Calculator } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { TONE_CLASSES, type Health } from "@/domain/health";
import { cn } from "@/lib/utils";
import { HealthBadge } from "./Health";

/**
 * KPI tile. Health colour is applied only when `health` is given and not
 * neutral – informational metrics stay neutral. Clickable tiles open the
 * calculation behind the number.
 */
export function KpiCard({
  label,
  value,
  sub,
  health,
  onClick,
  loading,
  className,
  size = "md",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  health?: Health;
  onClick?: () => void;
  loading?: boolean;
  className?: string;
  size?: "md" | "lg";
}) {
  const tone = health?.tone ?? "neutral";
  const c = TONE_CLASSES[tone];
  const Comp = onClick ? "button" : "div";
  return (
    <Card className={cn("relative overflow-hidden border-l-4 text-left", c.border, onClick && "transition-shadow hover:shadow-md", className)}>
      <Comp
        {...(onClick ? { type: "button" as const, onClick, "aria-label": `${label} – show calculation` } : {})}
        className={cn("group block h-full w-full p-4 text-left", onClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {onClick && <Calculator className="size-3.5 shrink-0 text-muted-foreground/60 group-hover:text-primary" aria-hidden />}
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-24" />
        ) : (
          <p className={cn("mt-1 whitespace-nowrap font-semibold tracking-tight tabular", size === "lg" ? "text-2xl" : "text-xl", tone !== "neutral" && c.text)}>{value}</p>
        )}
        {!loading && (sub || (health && health.label)) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {health && <HealthBadge health={health} />}
            {sub && <span>{sub}</span>}
          </div>
        )}
      </Comp>
    </Card>
  );
}
