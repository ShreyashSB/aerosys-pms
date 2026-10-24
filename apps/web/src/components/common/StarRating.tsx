import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 1–5 star rating. With `onChange` it is an input (each star is a button);
 * without it, it only displays the value.
 */
export function StarRating({
  value,
  onChange,
  size = "md",
  label = "Rating",
}: {
  value: number;
  onChange?: (v: 1 | 2 | 3 | 4 | 5) => void;
  size?: "sm" | "md";
  label?: string;
}) {
  const stars = [1, 2, 3, 4, 5] as const;
  const icon = size === "sm" ? "size-3.5" : "size-5";
  if (!onChange) {
    return (
      <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${label}: ${value} out of 5`}>
        {stars.map((n) => (
          <Star key={n} className={cn(icon, n <= Math.round(value) ? "fill-warning text-warning" : "text-muted-foreground/40")} />
        ))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1" role="radiogroup" aria-label={label}>
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          className="rounded p-0.5 cursor-pointer hover:scale-110 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Star className={cn(icon, n <= value ? "fill-warning text-warning" : "text-muted-foreground/50")} />
        </button>
      ))}
    </span>
  );
}
