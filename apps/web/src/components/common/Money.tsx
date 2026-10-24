import { formatINR, formatINRShort } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Short Indian notation with the full amount in a tooltip. */
export function Money({ value, className, signed }: { value: number; className?: string; signed?: boolean }) {
  return (
    <span
      className={cn("tabular", signed && value < 0 && "text-danger", signed && value > 0 && "text-success", className)}
      title={formatINR(value)}
    >
      {formatINRShort(value)}
    </span>
  );
}
