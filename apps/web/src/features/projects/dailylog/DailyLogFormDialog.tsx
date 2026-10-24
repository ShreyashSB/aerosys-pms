import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Plus, Trash2, UserPlus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useCurrentUser } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { useAppData } from "@/hooks/useAppData";
import { useSaveDailyLog } from "@/hooks/mutations";
import { ATTENDANCE_LABEL, IDLE_REASONS, MAN_DAY_WEIGHT } from "@/domain/assumptions";
import { summariseLog } from "@/domain/performance";
import { EXPENSE_CATEGORIES } from "@/features/expenses/ExpenseFormDialog";
import { parseISODate, todayISO } from "@/lib/dates";
import { formatINR, formatNumber, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AttendanceEntry, AttendanceStatus, DailyLog, ExpenseCategory, IdleReason, Project } from "@/types/models";

type WorkLine = { boqItemId: string; qty: string; remarks: string };
type ExpenseLine = { employeeId: string; category: ExpenseCategory; amount: string; description: string };

const STATUSES = Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[];

export function DailyLogFormDialog({
  open,
  onOpenChange,
  project,
  log,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: Project;
  /** Edit an existing log. */
  log?: DailyLog | null;
}) {
  const { user } = useCurrentUser();
  const data = useAppData();
  const save = useSaveDailyLog();
  const showCost = can(user.role, "rates.view");
  const hours = data.settings.hoursPerManDay;

  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<AttendanceEntry[]>([]);
  const [work, setWork] = useState<WorkLine[]>([]);
  const [expenses, setExpenses] = useState<ExpenseLine[]>([]);
  const [activities, setActivities] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [addPerson, setAddPerson] = useState("");

  const items = useMemo(
    () => data.boqItems.filter((b) => b.projectId === project.id).sort((a, b) => a.srNo.localeCompare(b.srNo, undefined, { numeric: true })),
    [data.boqItems, project.id],
  );
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const boqValue = items.reduce((s, i) => s + i.contractQty * i.rate, 0);
  /** Executed qty per item, excluding this log's own quantities (edit mode). */
  const executed = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of data.boqExecutions) if (x.projectId === project.id && x.dailyLogId !== log?.id) m.set(x.boqItemId, (m.get(x.boqItemId) ?? 0) + x.qty);
    return m;
  }, [data.boqExecutions, project.id, log?.id]);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setAddPerson("");
    if (log) {
      setDate(log.date);
      setRows(log.attendance.map((a) => ({ ...a })));
      setWork(data.boqExecutions.filter((x) => x.dailyLogId === log.id).map((x) => ({ boqItemId: x.boqItemId, qty: String(x.qty), remarks: x.remarks })));
      setActivities(log.activities);
      setRemarks(log.remarks);
      setExpenses([]);
      return;
    }
    const logged = new Set(data.dailyLogs.filter((l) => l.projectId === project.id).map((l) => l.date));
    const d = logged.has(todayISO()) ? "" : todayISO();
    setDate(d);
    const sunday = d && parseISODate(d).getDay() === 0;
    setRows(
      data.assignments
        .filter((a) => a.projectId === project.id && !a.endDate)
        .map((a) => ({ employeeId: a.employeeId, status: sunday ? "weekly_off" : "on_site", idleHours: 0, idleReason: null })),
    );
    setWork([{ boqItemId: "", qty: "", remarks: "" }]);
    setExpenses([]);
    setActivities("");
    setRemarks("");
  }, [open, log?.id]);

  const summary = summariseLog(rows, hours, (id) => data.employeeById.get(id)?.dailyCost ?? 0);
  const workValue = work.reduce((s, w) => s + (Number(w.qty) || 0) * (itemById.get(w.boqItemId)?.rate ?? 0), 0);
  const expenseTotal = expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const dateTaken = data.dailyLogs.some((l) => l.projectId === project.id && l.date === date && l.id !== log?.id);

  const errors = {
    date: !date ? "Date is required" : date > todayISO() ? "Cannot log a future date" : date < project.startDate ? "Before project start" : dateTaken ? "A log already exists for this date" : undefined,
    rows: rows.length === 0 ? "Add at least one person" : undefined,
  };
  const rowError = (a: AttendanceEntry) =>
    (a.status === "idle" || a.idleHours > 0) && !a.idleReason ? "Reason required" : a.idleHours > hours ? `Max ${hours} h` : undefined;
  const workError = (w: WorkLine) => (!w.boqItemId && w.qty ? "Select item" : w.boqItemId && !(Number(w.qty) > 0) ? "Enter qty" : undefined);
  const expError = (x: ExpenseLine) => (!(Number(x.amount) > 0) ? "Amount" : !x.employeeId ? "Employee" : undefined);
  const hasErrors =
    !!errors.date || !!errors.rows || rows.some((r) => rowError(r)) || work.some((w) => workError(w)) || expenses.some((x) => expError(x));

  const setRow = (i: number, patch: Partial<AttendanceEntry>) =>
    setRows((rs) =>
      rs.map((r, k) => {
        if (k !== i) return r;
        const next = { ...r, ...patch };
        if (MAN_DAY_WEIGHT[next.status] === 0) next.idleHours = 0;
        if (next.status !== "idle" && !next.idleHours) next.idleReason = null;
        return next;
      }),
    );

  const candidates = data.employees.filter((e) => e.isSiteEngineer && e.status !== "inactive" && !rows.some((r) => r.employeeId === e.id));

  const submit = () => {
    setSubmitted(true);
    if (hasErrors) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    save.mutate(
      {
        actorId: user.employeeId,
        logId: log?.id,
        input: {
          projectId: project.id,
          date,
          attendance: rows,
          activities: activities.trim() || work.filter((w) => w.boqItemId).map((w) => itemById.get(w.boqItemId)?.description.split(/[–(]/)[0]!.trim()).join("; "),
          remarks: remarks.trim(),
          work: work.filter((w) => w.boqItemId && Number(w.qty) > 0).map((w) => ({ boqItemId: w.boqItemId, qty: Number(w.qty), remarks: w.remarks })),
          expenses: expenses.map((x) => ({ employeeId: x.employeeId, category: x.category, amount: Number(x.amount), description: x.description })),
        },
      },
      {
        onSuccess: () => {
          toast.success(log ? "Daily log updated" : "Daily log saved", {
            description: `${formatNumber(summary.manDays, 1)} MD${summary.idleManDays ? ` (${formatNumber(summary.idleManDays, 1)} idle)` : ""}${workValue ? ` · ${formatINR(workValue)} executed` : ""} — project KPIs updated.`,
          });
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        side="right"
        className="max-w-3xl"
        title={log ? "Edit daily work log" : "New daily work log"}
        description={project.name}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancel</Button>
            <Button onClick={submit} loading={save.isPending}>{log ? "Save changes" : "Save daily log"}</Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date" htmlFor="dl-date" required error={submitted || dateTaken ? errors.date : undefined}>
              <Input id="dl-date" type="date" value={date} max={todayISO()} min={project.startDate} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.date && submitted} />
            </Field>
            {/* Live impact preview – shows how the log feeds the project */}
            <div className="grid grid-cols-3 gap-2 rounded-lg border bg-primary-soft/40 p-3 text-center sm:col-span-2">
              <Preview label="Man-days" value={formatNumber(summary.manDays, 1)} />
              <Preview label="Idle MD" value={formatNumber(summary.idleManDays, 1)} warn={summary.idleManDays > 0} />
              <Preview label="Work value" value={workValue ? formatINR(workValue) : "—"} sub={boqValue && workValue ? `+${formatPct((workValue / boqValue) * 100, 2)} progress` : undefined} />
            </div>
          </div>

          {/* Attendance */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Team / attendance</h3>
              <span className="text-xs text-muted-foreground">{hours} working hours = 1 man-day (Settings)</span>
            </div>
            {submitted && errors.rows && <p className="mb-2 text-xs text-danger">{errors.rows}</p>}
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Employee</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="w-24 px-3 py-2 text-left font-medium">Idle hrs</th>
                    <th className="px-3 py-2 text-left font-medium">Idle reason</th>
                    {showCost && <th className="px-3 py-2 text-right font-medium">Wage</th>}
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r, i) => {
                    const e = data.employeeById.get(r.employeeId);
                    const err = submitted ? rowError(r) : undefined;
                    const works = MAN_DAY_WEIGHT[r.status] > 0;
                    return (
                      <tr key={r.employeeId}>
                        <td className="px-3 py-2">
                          <p className="font-medium">{e?.name}</p>
                          <p className="text-xs text-muted-foreground">{e?.designation}</p>
                        </td>
                        <td className="px-3 py-2">
                          <Select value={r.status} onChange={(ev) => setRow(i, { status: ev.target.value as AttendanceStatus })} className={cn("h-8 text-xs", r.status === "idle" && "border-warning bg-warning-soft")} aria-label={`Status for ${e?.name}`}>
                            {STATUSES.map((s) => (<option key={s} value={s}>{ATTENDANCE_LABEL[s]}</option>))}
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" min={0} max={hours} step={0.5} className="h-8 text-xs" value={r.status === "idle" ? hours : r.idleHours || ""} disabled={!works || r.status === "idle"} onChange={(ev) => setRow(i, { idleHours: Number(ev.target.value) || 0 })} aria-label={`Idle hours for ${e?.name}`} placeholder="0" />
                        </td>
                        <td className="px-3 py-2">
                          <Select value={r.idleReason ?? ""} disabled={r.status !== "idle" && !r.idleHours} onChange={(ev) => setRow(i, { idleReason: (ev.target.value || null) as IdleReason | null })} className="h-8 text-xs" aria-invalid={!!err} aria-label={`Idle reason for ${e?.name}`}>
                            <option value="">—</option>
                            {IDLE_REASONS.map((x) => (<option key={x}>{x}</option>))}
                          </Select>
                          {err && <p className="mt-0.5 text-[11px] text-danger">{err}</p>}
                        </td>
                        {showCost && <td className="px-3 py-2 text-right text-xs tabular">{formatINR(MAN_DAY_WEIGHT[r.status] * (e?.dailyCost ?? 0))}</td>}
                        <td className="px-2 py-2">
                          <Button variant="ghost" size="icon-sm" onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))} aria-label={`Remove ${e?.name}`}><Trash2 className="text-muted-foreground" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Select value={addPerson} onChange={(e) => setAddPerson(e.target.value)} className="h-8 w-auto max-w-72 text-xs" aria-label="Add person">
                <option value="">Add another person…</option>
                {candidates.map((e) => (<option key={e.id} value={e.id}>{e.name} — {e.designation}</option>))}
              </Select>
              <Button variant="outline" size="sm" disabled={!addPerson} onClick={() => { setRows((rs) => [...rs, { employeeId: addPerson, status: "on_site", idleHours: 0, idleReason: null }]); setAddPerson(""); }}>
                <UserPlus /> Add
              </Button>
              <span className="ml-auto text-xs text-muted-foreground">
                {summary.people} people · {formatNumber(summary.workingManDays, 1)} working MD · {formatNumber(summary.idleManDays, 1)} idle MD
                {showCost && ` · wages ${formatINR(summary.wages)}`}
              </span>
            </div>
          </section>

          {/* Work done against BOQ */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">Work completed (updates BOQ execution & progress)</h3>
            {items.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">This project has no Annexure / BOQ items yet. Add items in the Annexure / BOQ tab to record executed quantities.</p>
            ) : (
              <div className="space-y-2">
                {work.map((w, i) => {
                  const it = itemById.get(w.boqItemId);
                  const balance = it ? it.contractQty - (executed.get(it.id) ?? 0) - work.filter((x, k) => k < i && x.boqItemId === it.id).reduce((s, x) => s + (Number(x.qty) || 0), 0) : 0;
                  const over = it && Number(w.qty) > balance;
                  const err = submitted ? workError(w) : undefined;
                  return (
                    <div key={i} className="grid grid-cols-12 items-start gap-2">
                      <div className="col-span-12 sm:col-span-6">
                        <Select value={w.boqItemId} onChange={(e) => setWork((ws) => ws.map((x, k) => (k === i ? { ...x, boqItemId: e.target.value } : x)))} className="h-8 text-xs" aria-label="BOQ item" aria-invalid={!!err}>
                          <option value="">Select BOQ item…</option>
                          {items.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.srNo}. {b.description} — bal {formatNumber(b.contractQty - (executed.get(b.id) ?? 0), 2)} {b.uom}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Input type="number" min={0} step="any" value={w.qty} onChange={(e) => setWork((ws) => ws.map((x, k) => (k === i ? { ...x, qty: e.target.value } : x)))} className="h-8 text-xs" placeholder={it ? `Qty (${it.uom})` : "Qty"} aria-label="Quantity" aria-invalid={!!err} />
                      </div>
                      <div className="col-span-7 sm:col-span-3">
                        <Input value={w.remarks} onChange={(e) => setWork((ws) => ws.map((x, k) => (k === i ? { ...x, remarks: e.target.value } : x)))} className="h-8 text-xs" placeholder="Location / remarks" aria-label="Work remarks" />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button variant="ghost" size="icon-sm" onClick={() => setWork((ws) => ws.filter((_, k) => k !== i))} aria-label="Remove work line"><Trash2 className="text-muted-foreground" /></Button>
                      </div>
                      {(err || over) && (
                        <p className={cn("col-span-12 -mt-1 text-[11px]", err ? "text-danger" : "text-warning")}>
                          {err ?? <><AlertTriangle className="mr-1 inline size-3" />Exceeds balance quantity ({formatNumber(balance, 2)} {it?.uom}) – allowed, but check for a variation.</>}
                        </p>
                      )}
                    </div>
                  );
                })}
                <Button variant="outline" size="sm" onClick={() => setWork((ws) => [...ws, { boqItemId: "", qty: "", remarks: "" }])}><Plus /> Add work line</Button>
              </div>
            )}
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Activities performed" htmlFor="dl-act" hint="Defaults to the BOQ items worked on">
              <Textarea id="dl-act" rows={3} value={activities} onChange={(e) => setActivities(e.target.value)} placeholder="e.g. AHU installation on level 2, ducting supports" />
            </Field>
            <Field label="Remarks" htmlFor="dl-rem">
              <Textarea id="dl-rem" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Site not ready at north wing; client informed" />
            </Field>
          </div>

          {!log && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Daily expenses <span className="font-normal text-muted-foreground">(optional · submitted for approval)</span></h3>
                {expenseTotal > 0 && <span className="text-xs text-muted-foreground">Total {formatINR(expenseTotal)}</span>}
              </div>
              <div className="space-y-2">
                {expenses.map((x, i) => {
                  const err = submitted ? expError(x) : undefined;
                  return (
                    <div key={i} className="grid grid-cols-12 gap-2">
                      <Select value={x.employeeId} onChange={(e) => setExpenses((xs) => xs.map((y, k) => (k === i ? { ...y, employeeId: e.target.value } : y)))} className="col-span-6 h-8 text-xs sm:col-span-3" aria-label="Expense employee" aria-invalid={err === "Employee"}>
                        <option value="">Employee…</option>
                        {rows.map((r) => (<option key={r.employeeId} value={r.employeeId}>{data.employeeById.get(r.employeeId)?.name}</option>))}
                      </Select>
                      <Select value={x.category} onChange={(e) => setExpenses((xs) => xs.map((y, k) => (k === i ? { ...y, category: e.target.value as ExpenseCategory } : y)))} className="col-span-6 h-8 text-xs sm:col-span-3" aria-label="Expense category">
                        {EXPENSE_CATEGORIES.map((c) => (<option key={c}>{c}</option>))}
                      </Select>
                      <Input type="number" min={0} value={x.amount} onChange={(e) => setExpenses((xs) => xs.map((y, k) => (k === i ? { ...y, amount: e.target.value } : y)))} className="col-span-4 h-8 text-xs sm:col-span-2" placeholder="₹ Amount" aria-label="Expense amount" aria-invalid={err === "Amount"} />
                      <Input value={x.description} onChange={(e) => setExpenses((xs) => xs.map((y, k) => (k === i ? { ...y, description: e.target.value } : y)))} className="col-span-7 h-8 text-xs sm:col-span-3" placeholder="Description" aria-label="Expense description" />
                      <div className="col-span-1 flex justify-end">
                        <Button variant="ghost" size="icon-sm" onClick={() => setExpenses((xs) => xs.filter((_, k) => k !== i))} aria-label="Remove expense"><Trash2 className="text-muted-foreground" /></Button>
                      </div>
                    </div>
                  );
                })}
                <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => setExpenses((xs) => [...xs, { employeeId: rows[0]?.employeeId ?? "", category: "Food", amount: "", description: "" }])}><Plus /> Add expense</Button>
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Preview({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-base font-semibold tabular", warn && "text-warning")}>{value}</p>
      {sub && <p className="text-[11px] text-success">{sub}</p>}
    </div>
  );
}
