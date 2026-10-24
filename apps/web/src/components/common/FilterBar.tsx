import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function FilterBar({ children, onReset, showReset }: { children: ReactNode; onReset?: () => void; showReset?: boolean }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {children}
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
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "Search…"} className="pl-8" aria-label="Search" />
    </div>
  );
}
