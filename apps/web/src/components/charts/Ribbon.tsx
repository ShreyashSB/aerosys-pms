/**
 * One stacked bar showing each part's share of a total (used by "What we are spending on").
 * Parts are separated by a 2px gap; hovering a part dims the others, and the caller can link that
 * hover to a table row. Colours come from SEQUENTIAL, defined per theme in index.css.
 */
import { cn } from "@/lib/utils";

export function Ribbon({
  parts,
  hover,
  onHover,
}: {
  parts: Array<{ key: string; label: string; value: number; color: string }>;
  hover?: string | null;
  onHover?: (key: string | null) => void;
}) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div className="flex h-7 w-full gap-0.5" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(", ")}>
      {parts
        .filter((p) => p.value > 0)
        .map((p) => (
          <span
            key={p.key}
            className={cn("block h-full rounded-md transition-opacity", hover && hover !== p.key ? "opacity-40" : "opacity-100")}
            style={{ width: `${(p.value / total) * 100}%`, minWidth: 4, background: p.color }}
            onMouseEnter={() => onHover?.(p.key)}
            onMouseLeave={() => onHover?.(null)}
          />
        ))}
    </div>
  );
}

/** Sequential blues for parts of a whole, first head strongest. Values live in index.css per theme. */
export const SEQUENTIAL = ["var(--color-seq-1)", "var(--color-seq-2)", "var(--color-seq-3)", "var(--color-seq-4)", "var(--color-seq-5)", "var(--color-seq-6)"];
