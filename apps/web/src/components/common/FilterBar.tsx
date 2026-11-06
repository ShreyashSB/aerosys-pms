import { Children, isValidElement, useState, type ReactNode } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Below this many items a list is short enough to scan, so its filters are hidden. */
const FEW_ITEMS = 8;

/**
 * Search box plus filter dropdowns above a list.
 *
 * Laptops: everything in one row. Phones: the search box stays, and the dropdowns fold behind a
 * "Filters" button that shows how many are on, so they don't take four rows of the screen.
 * Pass `total` (how many items the list has before filtering) to hide the bar on short lists.
 */
export function FilterBar({ children, onReset, showReset, total }: { children: ReactNode; onReset?: () => void; showReset?: boolean; total?: number }) {
  const [open, setOpen] = useState(false);
  if (total !== undefined && total < FEW_ITEMS && !showReset) return null;

  const items = Children.toArray(children);
  const first = items[0];
  const hasSearch = isValidElement(first) && first.type === SearchInput;
  const search = hasSearch ? first : null;
  const rest = hasSearch ? items.slice(1) : items;
  // Dropdowns with a value picked (the "All …" option has an empty value).
  const activeCount = rest.filter((c) => isValidElement<{ value?: unknown }>(c) && !!c.props.value).length;

  return (
    <div className="mb-4 space-y-2 md:flex md:flex-wrap md:items-center md:gap-2 md:space-y-0">
      <div className="flex items-center gap-2 md:contents">
        {search}
        {rest.length > 0 && (
          <Button variant="outline" className="shrink-0 md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <SlidersHorizontal /> Filters{activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{activeCount}</span>}
          </Button>
        )}
      </div>
      {/* Phones: full-width dropdowns, shown when "Filters" is open. Laptops: always inline. */}
      <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2 md:contents [&>select]:w-full md:[&>select]:w-auto", !open && "hidden md:contents")}>
        {rest}
      </div>
      {showReset && onReset && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X /> Clear filters
        </Button>
      )}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full min-w-0 sm:w-64">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "Search…"} className="pl-8" aria-label="Search" />
    </div>
  );
}
