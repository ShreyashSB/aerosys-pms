import * as TabsPrimitive from "@radix-ui/react-tabs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

/**
 * A row of tabs that scrolls sideways when it doesn't fit (a project has up to ten tabs).
 * When tabs are hidden off either edge, that edge fades out and shows an arrow button, so people can
 * see there is more. The selected tab is always scrolled into view.
 */
export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Keep the selected tab visible, e.g. when a page opens straight on "Costs".
    // (Scrolls only the tab row sideways; scrollIntoView would also jump the page up or down.)
    const reveal = () => {
      const tab = el.querySelector<HTMLElement>('[data-state="active"]');
      if (!tab) return;
      const pad = 40;
      if (tab.offsetLeft - pad < el.scrollLeft) el.scrollLeft = tab.offsetLeft - pad;
      else if (tab.offsetLeft + tab.offsetWidth + pad > el.scrollLeft + el.clientWidth) el.scrollLeft = tab.offsetLeft + tab.offsetWidth + pad - el.clientWidth;
    };
    reveal();
    const mo = new MutationObserver(reveal);
    mo.observe(el, { subtree: true, attributeFilter: ["data-state"] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [measure]);

  const nudge = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.6, behavior: "smooth" });
  const arrow =
    "absolute top-0 bottom-px z-10 flex w-9 items-center justify-center bg-background text-muted-foreground hover:text-foreground cursor-pointer";

  return (
    <div className="relative">
      <TabsPrimitive.List
        ref={ref}
        onScroll={measure}
        className={cn(
          "scroll-fade-x flex gap-1 overflow-x-auto border-b",
          edges.left && edges.right
            ? "[mask-image:linear-gradient(to_right,transparent,black_4rem,black_calc(100%-4rem),transparent)]"
            : edges.left
              ? "[mask-image:linear-gradient(to_right,transparent,black_4rem)]"
              : edges.right && "[mask-image:linear-gradient(to_left,transparent,black_4rem)]",
          className,
        )}
        {...props}
      />
      {edges.left && (
        <button type="button" tabIndex={-1} aria-hidden onClick={() => nudge(-1)} className={cn(arrow, "left-0")}>
          <ChevronLeft className="size-4" />
        </button>
      )}
      {edges.right && (
        <button type="button" tabIndex={-1} aria-hidden onClick={() => nudge(1)} className={cn(arrow, "right-0")}>
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "-mb-px inline-flex items-center gap-2 whitespace-nowrap rounded-t-md border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer data-[state=active]:border-primary data-[state=active]:text-primary [&_svg]:size-4",
        // Same focus ring as buttons, only for keyboard use (no black box after a mouse click).
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("pt-5 focus:outline-none", className)} {...props} />;
}
