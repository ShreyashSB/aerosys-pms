import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Returning a value enables sorting on this column. */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right" | "center";
  className?: string;
  /** Hide on small screens. */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  initialSort?: { key: string; dir: "asc" | "desc" };
  footer?: ReactNode;
  className?: string;
  /**
   * Phones only: render each row as a small card instead of a table row, so nothing scrolls sideways.
   * Laptops keep the table. Without it, phones get the table with a scroll shadow on the edge.
   */
  mobileCard?: (row: T) => ReactNode;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  empty,
  onRowClick,
  pageSize = 10,
  initialSort,
  footer,
  className,
  mobileCard,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const toggleSort = (key: string) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  const alignCls = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-surface", className)}>
      {mobileCard && (
        <ul className="divide-y md:hidden">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="space-y-2 px-4 py-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </li>
              ))
            : visible.map((row) => (
                <li key={rowKey(row)}>
                  {onRowClick ? (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onRowClick(row)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }}
                      className="block w-full cursor-pointer px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      {mobileCard(row)}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-sm">{mobileCard(row)}</div>
                  )}
                </li>
              ))}
        </ul>
      )}
      {/* "relative" keeps visually hidden (sr-only) header text inside the scroll area; without it the page scrolls sideways on phones.
          "scroll-shadow-x" shows a soft shadow on whichever edge has more columns to scroll to. */}
      <div className={cn("scroll-shadow-x relative overflow-x-auto", mobileCard && "hidden md:block")}>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn("px-3 py-2.5 font-medium whitespace-nowrap first:pl-4 last:pr-4 2xl:px-4", alignCls(c.align), c.hideOnMobile && "hidden md:table-cell", c.className)}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn("inline-flex items-center gap-1 uppercase hover:text-foreground cursor-pointer", c.align === "right" && "flex-row-reverse")}
                    >
                      {c.header}
                      {sort?.key === c.key ? (
                        sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                      ) : (
                        <ArrowUpDown className="size-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.key} className={cn("px-4 py-3", c.hideOnMobile && "hidden md:table-cell")}>
                        <Skeleton className="h-4 w-full max-w-40" />
                      </td>
                    ))}
                  </tr>
                ))
              : visible.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn("transition-colors hover:bg-muted/50", onRowClick && "cursor-pointer")}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={cn("px-3 py-3 align-middle first:pl-4 last:pr-4 2xl:px-4", alignCls(c.align), c.hideOnMobile && "hidden md:table-cell", c.className)}>
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
          {footer && !loading && rows.length > 0 && <tfoot className="border-t bg-muted/40 font-medium">{footer}</tfoot>}
        </table>
      </div>
      {!loading && rows.length === 0 && <div className="border-t">{empty}</div>}
      {!loading && sorted.length > pageSize && (
        <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            Showing {safePage * pageSize + 1}–{Math.min(sorted.length, (safePage + 1) * pageSize)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span className="px-2 whitespace-nowrap">
              Page {safePage + 1} / {pageCount}
            </span>
            <Button variant="outline" size="icon-sm" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
