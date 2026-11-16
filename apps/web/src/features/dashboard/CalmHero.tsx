/**
 * Calm style dashboard header: a big greeting with a portfolio progress ring and the dashboard's financial numbers
 * shown large. It replaces the page header and the "Financial overview" tiles only when the Calm style is on; the
 * numbers are the same ones those tiles show (same useScopedData portfolio figures), and everything below the header
 * (execution tiles, attention list, charts, tables) is unchanged. Money only appears for roles with finance.view.
 */
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import type { useScopedData } from "@/hooks/useAppData";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { TONE_CLASSES, type Health } from "@/domain/health";
import { formatINRShort, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

type Scoped = ReturnType<typeof useScopedData>;

const longDate = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" });

function partOfDay() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** "₹4.82 Cr" → ₹ small and raised, number big, unit small. */
function BigMoney({ value }: { value: number }) {
  const m = formatINRShort(value).match(/^(-?)₹([\d.,]+)\s?(Cr|L|K)?$/);
  if (!m) return <>{formatINRShort(value)}</>;
  return (
    <>
      {m[1]}
      <span className="mr-0.5 align-top text-[0.45em] font-medium">₹</span>
      {m[2]}
      {m[3] && <span className="ml-1 text-[0.45em] font-medium">{m[3]}</span>}
    </>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="relative size-[88px] shrink-0" role="img" aria-label={`${Math.round(pct * 100)}% of the portfolio executed`}>
      <svg viewBox="0 0 80 80" className="size-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--calm-ring-track)" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--calm-accent)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} className="transition-[stroke-dasharray] duration-700" />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-base font-semibold tabular">{Math.round(pct * 100)}%</span>
        <span className="mt-1 text-[11px] text-muted-foreground">done</span>
      </span>
    </div>
  );
}

/** Health text sits on the green ground, so it uses the ground's own colours with a small coloured dot for the tone. */
function HealthLine({ health }: { health: Health }) {
  if (!health.label) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full ring-2 ring-[var(--calm-on)]", TONE_CLASSES[health.tone].dot)} />
      {health.label}
    </span>
  );
}

function HeroStat({ label, value, sub, onClick }: { label: string; value: ReactNode; sub: ReactNode; onClick?: () => void }) {
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p data-slot="hero-number" className="mt-1 whitespace-nowrap tabular">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </>
  );
  if (!onClick) return <div className="min-w-0">{body}</div>;
  return (
    <button type="button" onClick={onClick} className="min-w-0 cursor-pointer rounded-2xl text-left transition-colors hover:bg-[var(--calm-glass)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--calm-accent)] -m-2 p-2">
      {body}
    </button>
  );
}

export function CalmHero({
  data,
  firstName,
  showFinance,
  canCreate,
  costHealth,
  profitHealth,
  onNewProject,
  onOpenPnl,
}: {
  data: Scoped;
  firstName: string;
  showFinance: boolean;
  canCreate: boolean;
  costHealth: Health;
  profitHealth: Health;
  onNewProject: () => void;
  onOpenPnl: () => void;
}) {
  const s = data.portfolio;
  const issues = data.insights.filter((i) => i.tone === "bad").length;

  return (
    <section aria-label="Overview" className="space-y-5">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:gap-10">
        <div className="flex items-center gap-6">
          <h1 data-slot="calm-greeting" className="text-foreground">
            {partOfDay()},<br className="hidden sm:block" /> {firstName}
          </h1>
          {!data.isLoading && <ProgressRing value={s.progress} />}
        </div>
        {showFinance &&
          (data.isLoading ? (
            <Skeleton className="h-24 flex-1 rounded-2xl" />
          ) : (
            <div className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-6">
              <HeroStat
                label="Contract value"
                value={<BigMoney value={s.contractValue} />}
                sub={`${s.projectCount} projects · ${formatINRShort(s.earnedValue)} earned so far`}
              />
              <HeroStat label="Cost to date" value={<BigMoney value={s.costToDate} />} sub={<HealthLine health={costHealth} />} />
              <HeroStat
                label="Projected profit"
                value={<BigMoney value={s.finalProfit} />}
                sub={
                  <>
                    <HealthLine health={{ ...profitHealth, label: `${profitHealth.label ? `${profitHealth.label} · ` : ""}${formatPct(s.finalMarginPct)} margin` }} /> · final cost {formatINRShort(s.finalCost)} · estimate
                  </>
                }
                onClick={onOpenPnl}
              />
            </div>
          ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {longDate.format(new Date())}
          {issues > 0 ? (
            <>
              {" · "}
              <span className="font-medium text-foreground">
                {issues} issue{issues > 1 ? "s" : ""} need{issues > 1 ? "" : "s"} attention
              </span>
            </>
          ) : (
            " · Everything is on track"
          )}
        </p>
        {canCreate && (
          <Button onClick={onNewProject} className="self-start sm:self-auto">
            <Plus /> New project
          </Button>
        )}
      </div>
    </section>
  );
}
