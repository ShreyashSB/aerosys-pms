import { Info } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { HealthBadge } from "@/components/common/Health";
import { profitHealth } from "@/domain/health";
import { PROJECTION_LABEL } from "@/domain/assumptions";
import type { CostHeads } from "@/domain/performance";
import { formatINR, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppSettings } from "@/types/models";

export interface PnlData {
  title: string;
  contractValue: number;
  costs: CostHeads;
  earnedValue: number;
  remainingCost: number;
  finalCost: number;
  finalProfit: number;
  finalMarginPct: number;
  projectionMethod?: keyof typeof PROJECTION_LABEL | "mixed";
  progress: number;
}

/** "Show me why this number is what it is" – profit & loss drill-down. */
export function PnlDrawer({ data, settings, onClose }: { data: PnlData | null; settings: AppSettings; onClose: () => void }) {
  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      {data && (
        <DialogContent side="right" className="max-w-lg" title="Profit & loss breakdown" description={data.title}>
          <PnlStatement data={data} settings={settings} />
        </DialogContent>
      )}
    </Dialog>
  );
}

export function PnlStatement({ data, settings }: { data: PnlData; settings: AppSettings }) {
  const c = data.costs;
  const lines: Array<[string, number]> = [
    ["Wages", c.wages],
    ["Expenses", c.expenses],
    ["Overhead", c.overhead],
    ["Instrument charges", c.instruments],
    ["Management charges", c.management],
  ];
  if (c.other > 0) lines.push(["Other direct costs", c.other]);
  const health = profitHealth(data.finalMarginPct, settings);

  return (
    <div className="space-y-5 text-sm">
      <section>
        <Row label="Contract / work order value" value={data.contractValue} strong />
        <p className="mt-3 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Less: actual cost to date</p>
        {lines.map(([l, v]) => (
          <Row key={l} label={l} value={v} indent pct={data.contractValue ? (v / data.contractValue) * 100 : 0} />
        ))}
        <Row label="Actual cost to date" value={c.total} strong rule />
      </section>

      <section className="rounded-lg border bg-muted/30 p-2">
        <Row label={`Current earned value (${formatPct(data.progress * 100)} progress)`} value={data.earnedValue} />
        <Row label="Current contribution (earned value − cost to date)" value={data.earnedValue - c.total} signed strong />
      </section>

      <section>
        <p className="mb-1 flex items-center gap-2 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Projection <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[10px] normal-case text-warning">Estimate</span>
        </p>
        <Row label="Actual cost to date" value={c.total} />
        <Row label="Projected remaining cost" value={data.remainingCost} op="+" />
        <Row label="Projected final cost" value={data.finalCost} strong rule />
        <Row label="Contract value" value={data.contractValue} />
        <Row label="Projected final profit" value={data.finalProfit} op="=" signed strong rule />
        <div className="flex items-center justify-between px-2 py-2">
          <span className="font-semibold">Projected profit margin</span>
          <span className="flex items-center gap-2">
            <HealthBadge health={health} />
            <span className="text-base font-semibold tabular">{formatPct(data.finalMarginPct)}</span>
          </span>
        </div>
      </section>

      <p className="flex gap-1.5 rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Projected values are estimates, not actual profit.{" "}
          {data.projectionMethod && data.projectionMethod !== "mixed" ? `Method: ${PROJECTION_LABEL[data.projectionMethod]}.` : "Each project uses its own projection (see project pages)."} Overhead and management
          charges use demo rates from Settings ({formatPct(settings.overheadPctOfWages)} of wages, {formatPct(settings.managementPctOfEarnedValue)} of earned value).
        </span>
      </p>
    </div>
  );
}

function Row({ label, value, strong, indent, rule, signed, op, pct }: { label: string; value: number; strong?: boolean; indent?: boolean; rule?: boolean; signed?: boolean; op?: string; pct?: number }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 px-2 py-1.5", rule && "mt-1 border-t pt-2.5", indent && "pl-6")}>
      <span className={cn(strong ? "font-semibold" : "text-muted-foreground")}>
        {op && <span className="mr-2 font-mono">{op}</span>}
        {label}
      </span>
      <span className="flex items-baseline gap-2">
        {pct !== undefined && <span className="text-xs text-muted-foreground tabular">{formatPct(pct)}</span>}
        <span className={cn("tabular", strong && "font-semibold", signed && value < 0 && "text-danger", signed && value > 0 && "text-success")}>{formatINR(value)}</span>
      </span>
    </div>
  );
}
