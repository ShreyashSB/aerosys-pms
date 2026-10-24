import { Info } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Explanation } from "@/domain/explain";
import { cn } from "@/lib/utils";

/** Equation-style "how was this calculated" panel. */
export function CalcDrawer({ explanation, onClose }: { explanation: Explanation | null; onClose: () => void }) {
  return (
    <Dialog open={!!explanation} onOpenChange={(o) => !o && onClose()}>
      {explanation && (
        <DialogContent side="right" title={explanation.title} description={explanation.subtitle ?? "How this number is calculated"} className="max-w-md">
          <CalcSteps explanation={explanation} />
        </DialogContent>
      )}
    </Dialog>
  );
}

export function CalcSteps({ explanation }: { explanation: Explanation }) {
  return (
    <div className="space-y-5">
      <ol className="space-y-1">
        {explanation.steps.map((s, i) => (
          <li
            key={i}
            className={cn(
              "grid grid-cols-[1.5rem_1fr_auto] items-baseline gap-2 rounded-md px-2 py-2",
              s.op === "=" && "border-t pt-3",
              s.strong && "bg-primary-soft/50",
            )}
          >
            <span className="text-center font-mono text-base text-muted-foreground">{s.op ?? ""}</span>
            <span className={cn("text-sm", s.strong ? "font-semibold" : "text-muted-foreground")}>{s.label}</span>
            <span className={cn("text-right text-sm tabular", s.strong ? "text-base font-semibold" : "font-medium")}>{s.value}</span>
          </li>
        ))}
      </ol>
      {explanation.notes && explanation.notes.length > 0 && (
        <div className="space-y-1.5 rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
          {explanation.notes.map((n, i) => (
            <p key={i} className="flex gap-1.5">
              <Info className="mt-0.5 size-3.5 shrink-0" /> {n}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
