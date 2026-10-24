import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Receipt, Search, User, Wrench } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useScopedData } from "@/hooks/useAppData";
import { Kbd } from "@/components/ui/misc";
import { formatINR } from "@/lib/format";
import { cn, includesText } from "@/lib/utils";

interface Result {
  id: string;
  group: string;
  title: string;
  subtitle: string;
  to: string;
  icon: typeof Search;
}

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { can } = useAuth();
  const data = useScopedData();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo<Result[]>(() => {
    if (q.trim().length < 2) return [];
    const out: Result[] = [];
    for (const p of data.scopedProjects) {
      if (includesText([p.name, p.clientName, p.site, p.code], q))
        out.push({ id: p.id, group: "Projects", title: p.name, subtitle: `${p.clientName} · ${p.site}`, to: `/projects/${p.id}`, icon: FolderKanban });
    }
    if (can("engineer.view") || can("employee.view")) {
      for (const e of data.employees) {
        if (includesText([e.name, e.code, e.designation], q))
          out.push({
            id: e.id,
            group: "People",
            title: e.name,
            subtitle: `${e.code} · ${e.designation}`,
            to: e.isSiteEngineer && can("engineer.view") ? `/engineers/${e.id}` : `/employees?q=${encodeURIComponent(e.name)}`,
            icon: User,
          });
      }
    }
    if (can("instrument.view")) {
      for (const i of data.scopedInstruments) {
        if (includesText([i.name, i.code, i.serialNumber], q))
          out.push({ id: i.id, group: "Instruments", title: i.name, subtitle: `${i.code} · SN ${i.serialNumber}`, to: `/instruments?q=${encodeURIComponent(i.code)}`, icon: Wrench });
      }
    }
    for (const x of data.scopedExpenses) {
      if (includesText([x.code, x.description], q))
        out.push({
          id: x.id,
          group: "Expenses",
          title: `${x.code} · ${x.description}`,
          subtitle: `${data.employeeById.get(x.employeeId)?.name ?? ""} · ${formatINR(x.amount)}`,
          to: `/expenses?q=${encodeURIComponent(x.code)}`,
          icon: Receipt,
        });
    }
    return out.slice(0, 12);
  }, [q, data, can]);

  const go = (r: Result) => {
    navigate(r.to);
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
  };

  let lastGroup = "";
  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && results[active]) go(results[active]);
          else if (e.key === "Escape") inputRef.current?.blur();
        }}
        placeholder="Search projects, people, instruments, expenses…"
        className="h-9 w-full rounded-md border border-input bg-muted/50 pl-9 pr-14 text-sm placeholder:text-muted-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-ring/30"
        aria-label="Global search"
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:block">
        <Kbd>Ctrl K</Kbd>
      </span>
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-11 z-50 max-h-96 overflow-y-auto rounded-md border bg-surface p-1 shadow-lg animate-in">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results for “{q}”</p>
          ) : (
            results.map((r, i) => {
              const header = r.group !== lastGroup ? r.group : null;
              lastGroup = r.group;
              return (
                <div key={`${r.group}-${r.id}`}>
                  {header && <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{header}</p>}
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(r)}
                    onMouseEnter={() => setActive(i)}
                    className={cn("flex w-full items-center gap-3 rounded px-2 py-1.5 text-left cursor-pointer", i === active && "bg-muted")}
                  >
                    <r.icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{r.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
