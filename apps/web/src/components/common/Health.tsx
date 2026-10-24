import { CheckCircle2, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { TONE_CLASSES, type Health, type Tone } from "@/domain/health";
import { cn } from "@/lib/utils";

const ICON: Record<Tone, typeof Info> = { good: CheckCircle2, warn: AlertTriangle, bad: AlertCircle, neutral: Info };

/** Status chip – colour is always paired with an icon and a text label. */
export function HealthBadge({ health, className }: { health: Health; className?: string }) {
  if (!health.label) return null;
  const Icon = ICON[health.tone];
  const c = TONE_CLASSES[health.tone];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", c.bg, c.text, className)}>
      <Icon className="size-3" aria-hidden />
      {health.label}
    </span>
  );
}
