import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon,
  loading,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  tone?: "positive" | "negative";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <p
          className={cn(
            "mt-1.5 whitespace-nowrap text-2xl font-semibold tracking-tight tabular",
            tone === "positive" && "text-success",
            tone === "negative" && "text-danger",
          )}
        >
          {value}
        </p>
      )}
      {hint && !loading && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
