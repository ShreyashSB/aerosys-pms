import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, History, X } from "lucide-react";
import { historyService } from "@/services";
import { useAppData } from "@/hooks/useAppData";
import { useUrlState } from "@/hooks/useUrlState";
import { FilterBar, SearchInput } from "@/components/common/FilterBar";
import { EmptyState, ErrorState } from "@/components/common/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Avatar, Skeleton } from "@/components/ui/misc";
import { ACTION_LABELS, ENTITY_LABELS, ENTITY_ORDER, fieldLabel, formatValue, moneyDelta } from "@/domain/history";
import { ROLE_LABELS } from "@/auth/permissions";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AuditAction, AuditEntity, AuditEntry, HistoryQuery, Role } from "@/types/models";

const ACTION_TONE: Record<AuditAction, "success" | "info" | "danger"> = { create: "success", update: "info", delete: "danger" };
const PAGE = 40;
/** Records whose name already says what they are ("Company settings", "Engineer reviews"). */
const SELF_NAMED = new Set<AuditEntity>(["settings", "reviews"]);

const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" });

/** "Today", "Yesterday" or the date, for the day headings. */
function dayHeading(iso: string) {
  const day = new Date(iso).toDateString();
  const today = new Date();
  if (day === today.toDateString()) return "Today";
  if (day === new Date(today.getTime() - 86400_000).toDateString()) return "Yesterday";
  return formatDate(iso);
}

/**
 * The change history as a feed: who changed what and when, newest first,
 * grouped by day. Each row opens to show every field before and after.
 * Filters live in the URL, so a filtered view can be shared as a link.
 * With `projectId` the feed shows only that project (the project's History tab).
 */
export function HistoryFeed({ projectId }: { projectId?: string }) {
  const data = useAppData();
  const filters = useUrlState(["q", "entity", "record", "person", "project", "action", "from", "to"] as const);
  const f = filters.values;
  const reset = filters.reset;
  const q = useDebounced(f.q.trim(), 300);
  const query: HistoryQuery = {
    q: q || undefined,
    entity: (f.entity as AuditEntity) || undefined,
    entityId: f.record || undefined,
    actorId: f.person || undefined,
    projectId: projectId ?? (f.project || undefined),
    action: (f.action as AuditAction) || undefined,
    from: f.from || undefined,
    to: f.to || undefined,
    limit: PAGE,
  };

  const history = useInfiniteQuery({
    queryKey: ["history", query],
    queryFn: ({ pageParam }) => historyService.list({ ...query, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Always fresh: someone may have just changed something on another screen.
    staleTime: 0,
  });
  const entries = useMemo(() => history.data?.pages.flatMap((p) => p.entries) ?? [], [history.data]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpen((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));

  const people = useMemo(() => [...data.employees].sort((a, b) => a.name.localeCompare(b.name)), [data.employees]);
  const projects = useMemo(() => [...data.projects].sort((a, b) => a.code.localeCompare(b.code)), [data.projects]);
  const recordLabel = f.record ? entries.find((e) => e.entityId === f.record)?.entityLabel : undefined;

  const showRecord = (e: AuditEntry) => filters.update({ entity: e.entity, record: e.entityId });

  if (history.error) return <ErrorState error={history.error} onRetry={() => history.refetch()} />;

  return (
    <div>
      <FilterBar onReset={reset} showReset={filters.active}>
        <SearchInput value={f.q} onChange={(v) => filters.set("q", v)} placeholder="Search name, value…" />
        <Select
          value={f.entity}
          onChange={(e) => filters.update({ entity: e.target.value, record: "" })}
          className="w-auto"
          aria-label="Filter by record type"
        >
          <option value="">All records</option>
          {ENTITY_ORDER.map((k) => (
            <option key={k} value={k}>{ENTITY_LABELS[k]}</option>
          ))}
        </Select>
        <Select value={f.person} onChange={(e) => filters.set("person", e.target.value)} className="w-auto max-w-48" aria-label="Filter by who made the change">
          <option value="">Anyone</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        {!projectId && (
          <Select value={f.project} onChange={(e) => filters.set("project", e.target.value)} className="w-auto max-w-56" aria-label="Filter by project">
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
            ))}
          </Select>
        )}
        <Select value={f.action} onChange={(e) => filters.set("action", e.target.value)} className="w-auto" aria-label="Filter by kind of change">
          <option value="">Added, changed, removed</option>
          {(Object.keys(ACTION_LABELS) as AuditAction[]).map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a]}</option>
          ))}
        </Select>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Input type="date" value={f.from} onChange={(e) => filters.set("from", e.target.value)} className="w-auto" aria-label="From date" />
          <span>to</span>
          <Input type="date" value={f.to} onChange={(e) => filters.set("to", e.target.value)} className="w-auto" aria-label="To date" />
        </div>
      </FilterBar>

      {f.record && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <History className="size-4 text-muted-foreground" />
          <span>
            Every change to <span className="font-medium">{recordLabel ? readableLabel(recordLabel) : ENTITY_LABELS[f.entity as AuditEntity] ?? "this record"}</span>
          </span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => filters.set("record", "")}>
            <X /> Show all
          </Button>
        </div>
      )}

      {history.isLoading ? (
        <Card className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={<History />}
            title={filters.active ? "No changes match these filters" : "No changes recorded yet"}
            description={
              filters.active
                ? "Try a wider date range or clear the filters."
                : "Every time someone adds, edits or removes a record, it shows up here with who did it and what changed."
            }
            action={filters.active ? <Button variant="outline" onClick={reset}>Clear filters</Button> : undefined}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ol>
            {entries.map((e, i) => {
              const heading = dayHeading(e.at);
              const newDay = i === 0 || heading !== dayHeading(entries[i - 1].at);
              return (
                <Fragment key={e.id}>
                  {newDay && (
                    <li className="border-b bg-muted/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground" aria-hidden>
                      {heading}
                    </li>
                  )}
                  <EntryRow entry={e} open={open.has(e.id)} onToggle={() => toggle(e.id)} onShowRecord={f.record ? undefined : () => showRecord(e)} inProject={!!projectId} />
                </Fragment>
              );
            })}
          </ol>
        </Card>
      )}

      {history.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => history.fetchNextPage()} loading={history.isFetchingNextPage}>
            Show older changes
          </Button>
        </div>
      )}
    </div>
  );
}

/** "Daily log 2026-06-16" → "Daily log 16 Jun 2026". */
function readableLabel(label: string) {
  return label.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (d) => formatDate(d));
}

/** The changed fields in one line, for the collapsed row: "Daily cost ₹2,200 → ₹2,600". */
function headline(e: AuditEntry) {
  if (e.action !== "update" || e.changes.length === 0) return null;
  if (e.changes.length > 2) return `${e.changes.length} fields: ${e.changes.slice(0, 3).map((c) => fieldLabel(c.field)).join(", ")}${e.changes.length > 3 ? "…" : ""}`;
  return e.changes.map((c) => `${fieldLabel(c.field)}: ${formatValue(c.field, c.from)} → ${formatValue(c.field, c.to)}`).join(" · ");
}

function EntryRow({ entry: e, open, onToggle, onShowRecord, inProject }: { entry: AuditEntry; open: boolean; onToggle: () => void; onShowRecord?: () => void; inProject: boolean }) {
  const verb = e.summary ? e.summary.charAt(0).toLowerCase() + e.summary.slice(1) : e.action === "create" ? "added" : e.action === "delete" ? "removed" : "changed";
  const line = headline(e);
  const fields = e.action === "update" ? "Before" : e.action === "create" ? null : "Removed value";

  return (
    <li className="border-b last:border-b-0">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none">
        <Avatar name={e.actorName} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-medium">{e.actorName}</span> <span className="text-muted-foreground">{verb}</span>{" "}
            {!SELF_NAMED.has(e.entity) && <span className="text-muted-foreground">{ENTITY_LABELS[e.entity]?.toLowerCase() ?? e.entity} </span>}<span className="font-medium break-words">{readableLabel(e.entityLabel)}</span>
          </p>
          {line && <p className="mt-0.5 line-clamp-2 text-sm break-words text-foreground/80 md:line-clamp-1">{line}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <time dateTime={e.at} title={new Date(e.at).toLocaleString("en-IN")}>{timeFmt.format(new Date(e.at))}</time>
            <span aria-hidden>·</span>
            <span>{ROLE_LABELS[e.actorRole as Role] ?? e.actorRole}</span>
            {e.projectLabel && !inProject && e.entity !== "project" && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{e.projectLabel}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={ACTION_TONE[e.action]}>{ACTION_LABELS[e.action]}</Badge>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4 md:pl-15">
          {e.changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No field values changed{e.summary ? ` (${e.summary.toLowerCase()})` : ""}.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Field</th>
                    {fields && <th className="px-3 py-2 font-medium">{fields}</th>}
                    {e.action !== "delete" && <th className="px-3 py-2 font-medium">{e.action === "create" ? "Value" : "After"}</th>}
                  </tr>
                </thead>
                <tbody>
                  {e.changes.map((c) => {
                    const delta = moneyDelta(c);
                    return (
                      <tr key={c.field} className="border-t align-top">
                        <td className="px-3 py-2 text-muted-foreground">{fieldLabel(c.field)}</td>
                        {fields && <td className={cn("px-3 py-2 break-words", e.action === "update" && "text-muted-foreground line-through decoration-muted-foreground/50")}>{formatValue(c.field, c.from)}</td>}
                        {e.action !== "delete" && (
                          <td className="px-3 py-2 font-medium break-words">
                            {formatValue(c.field, c.to)}
                            {delta && <span className="ml-2 text-xs font-normal text-muted-foreground">({delta})</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
            {onShowRecord && (
              <Button variant="outline" size="sm" onClick={onShowRecord}>
                <History /> All changes to this record
              </Button>
            )}
            {e.projectId && !inProject && (
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/projects/${e.projectId}`}>
                  Open project <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

/** The value once it has stopped changing for `ms`, so typing in the search box sends one request, not one per key. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
