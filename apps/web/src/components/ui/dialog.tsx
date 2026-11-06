import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  title,
  description,
  children,
  footer,
  className,
  side,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** "right" renders as a side drawer. */
  side?: "right";
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[1px] animate-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col bg-surface shadow-xl focus:outline-none",
          // dvh = the height actually visible, so the Save button never hides behind a phone's browser bar.
          side === "right"
            ? "inset-y-0 right-0 h-dvh w-full max-w-lg animate-slide-in border-l pb-[env(safe-area-inset-bottom)]"
            : // Phones: a sheet that rises from the bottom edge. Laptops: a centred box.
              "inset-x-0 bottom-0 mx-auto max-h-[92dvh] w-full max-w-lg rounded-t-xl border-t pb-[env(safe-area-inset-bottom)] animate-in md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[calc(100vw-2rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:border md:pb-0 md:max-h-[calc(100dvh-2rem)]",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="-m-2 flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:-m-1 md:size-8" aria-label="Close">
            <X className="size-5 md:size-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t bg-muted/40 px-5 py-3">{footer}</div>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
