import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { CostHeads } from "@/domain/performance";
import { formatINR, formatINRShort, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CostHead = Exclude<keyof CostHeads, "total">;

export const COST_HEADS: Array<{ key: CostHead; label: string; hint: string }> = [
  { key: "wages", label: "Wages", hint: "Man-days × daily cost" },
  { key: "expenses", label: "Expenses", hint: "Approved site expenses" },
  { key: "overhead", label: "Overhead", hint: "% of wages (demo)" },
  { key: "instruments", label: "Instrument charges", hint: "Usage charge on deployments" },
  { key: "management", label: "Management charges", hint: "% of earned value (demo)" },
  { key: "other", label: "Other direct costs", hint: "Hire, sub-contract…" },
];

/**
 * "What are we spending money on?" – bar per cost head (one hue: magnitude)
 * with the exact numeric table alongside. Hover links bar and row; clicking
 * opens the detail/calculation for that head.
 */
export function CostBreakdown({ costs, onSelect, budget }: { costs: CostHeads; onSelect?: (head: CostHead) => void; budget?: number }) {
  const [hover, setHover] = useState<CostHead | null>(null);
  const heads = COST_HEADS.filter((h) => h.key !== "other" || costs.other > 0);
  const max = Math.max(1, ...heads.map((h) => costs[h.key]));
  const total = costs.total || 1;

  return (
    <div>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 text-left font-medium">Cost head</th>
            <th className="hidden w-[38%] py-2 text-left font-medium sm:table-cell">
              <span className="sr-only">Chart</span>
            </th>
            <th className="py-2 text-right font-medium">Amount</th>
            <th className="w-16 py-2 text-right font-medium">Share</th>
            {onSelect && <th className="w-6" />}
          </tr>
        </thead>
        <tbody>
          {heads.map((h) => {
            const v = costs[h.key];
            return (
              <tr
                key={h.key}
                onMouseEnter={() => setHover(h.key)}
                onMouseLeave={() => setHover(null)}
                onClick={onSelect ? () => onSelect(h.key) : undefined}
                className={cn("border-b last:border-0 transition-colors", onSelect && "cursor-pointer", hover === h.key && "bg-muted/60")}
                title={`${h.label}: ${formatINR(v)} (${formatPct((v / total) * 100)} of cost to date)`}
              >
                <td className="py-2.5 pr-3">
                  <p className="font-medium">{h.label}</p>
                  <p className="hidden text-xs text-muted-foreground md:block">{h.hint}</p>
                </td>
                <td className="hidden py-2.5 pr-4 sm:table-cell">
                  <div className="h-2.5 w-full rounded-sm bg-muted">
                    <div
                      className={cn("h-full rounded-r-[4px] transition-opacity", hover && hover !== h.key ? "opacity-40" : "opacity-100")}
                      style={{ width: `${(v / max) * 100}%`, background: "var(--color-series-1)" }}
                    />
                  </div>
                </td>
                <td className="whitespace-nowrap py-2.5 text-right font-medium tabular">
                  <span title={formatINR(v)}>{formatINRShort(v)}</span>
                </td>
                <td className="py-2.5 text-right text-xs text-muted-foreground tabular">{formatPct((v / total) * 100)}</td>
                {onSelect && (
                  <td className="py-2.5 text-right">
                    <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 font-semibold">
            <td className="py-2.5">Total cost to date</td>
            <td className="hidden sm:table-cell" />
            <td className="whitespace-nowrap py-2.5 text-right tabular" title={formatINR(costs.total)}>{formatINRShort(costs.total)}</td>
            <td className="py-2.5 text-right text-xs tabular">100%</td>
            {onSelect && <td />}
          </tr>
          {budget !== undefined && budget > 0 && (
            <tr className="text-xs text-muted-foreground">
              <td className="pb-1">Budgeted total cost</td>
              <td className="hidden sm:table-cell" />
              <td className="pb-1 text-right tabular">{formatINRShort(budget)}</td>
              <td className="pb-1 text-right tabular">{formatPct((costs.total / budget) * 100, 0)} used</td>
              {onSelect && <td />}
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}
