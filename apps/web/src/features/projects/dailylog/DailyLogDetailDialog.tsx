import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ExpenseStatusBadge } from "@/components/common/StatusBadges";
import { useAppData } from "@/hooks/useAppData";
import { useDeleteDailyLog } from "@/hooks/mutations";
import { ATTENDANCE_LABEL, idleManDays, MAN_DAY_WEIGHT } from "@/domain/assumptions";
import { summariseLog } from "@/domain/performance";
import { formatDate, formatDateTime, formatINR, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STATUS_STYLE } from "./statusStyles";

export function DailyLogDetailDialog({
  logId,
  onClose,
  canEdit,
  showCost,
  onEdit,
}: {
  logId: string | null;
  onClose: () => void;
  canEdit: boolean;
  showCost: boolean;
  onEdit: (logId: string) => void;
}) {
  const data = useAppData();
  const del = useDeleteDailyLog();
  const [confirm, setConfirm] = useState(false);
  const log = logId ? data.dailyLogs.find((l) => l.id === logId) : null;
  const hours = data.settings.hoursPerManDay;

  return (
    <>
      <Dialog open={!!log} onOpenChange={(o) => !o && onClose()}>
        {log && (() => {
          const s = summariseLog(log.attendance, hours, (id) => data.employeeById.get(id)?.dailyCost ?? 0);
          const work = data.boqExecutions.filter((x) => x.dailyLogId === log.id);
          const exps = data.expenses.filter((e) => e.dailyLogId === log.id);
          const creator = data.employeeById.get(log.createdById);
          const itemById = new Map(data.boqItems.map((b) => [b.id, b]));
          const value = work.reduce((acc, x) => acc + x.qty * (itemById.get(x.boqItemId)?.rate ?? 0), 0);
          return (
            <DialogContent
              side="right"
              className="max-w-2xl"
              title={`Daily log · ${formatDate(log.date)}`}
              description={`${data.projectById.get(log.projectId)?.name} · recorded by ${creator?.name ?? "—"} · ${formatDateTime(log.updatedAt)}`}
              footer={
                canEdit ? (
                  <>
                    <Button variant="outline" className="text-danger" onClick={() => setConfirm(true)}><Trash2 /> Delete</Button>
                    <Button onClick={() => onEdit(log.id)}><Pencil /> Edit log</Button>
                  </>
                ) : undefined
              }
            >
              <div className="space-y-6 text-sm">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="People" value={String(s.people)} />
                  <Stat label="Working MD" value={formatNumber(s.workingManDays, 1)} />
                  <Stat label="Idle MD" value={formatNumber(s.idleManDays, 1)} warn={s.idleManDays > 0} />
                  <Stat label={showCost ? "Wages" : "Work value"} value={showCost ? formatINR(s.wages) : formatINR(value)} />
                </div>

                <section>
                  <h3 className="mb-2 font-semibold">Attendance</h3>
                  <div className="divide-y rounded-md border">
                    {log.attendance.map((a) => {
                      const e = data.employeeById.get(a.employeeId);
                      const imd = idleManDays(a.status, a.idleHours, hours);
                      return (
                        <div key={a.employeeId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <span>
                            <span className="font-medium">{e?.name}</span> <span className="text-xs text-muted-foreground">· {e?.designation}</span>
                          </span>
                          <span className="flex items-center gap-2 text-xs">
                            {imd > 0 && (
                              <span className="text-warning">
                                {a.status === "idle" ? "Full day idle" : `${a.idleHours} h idle`} · {a.idleReason}
                              </span>
                            )}
                            <span className={cn("rounded px-1.5 py-0.5", STATUS_STYLE[a.status].cls)}>{ATTENDANCE_LABEL[a.status]}</span>
                            <span className="w-12 text-right tabular text-muted-foreground">{MAN_DAY_WEIGHT[a.status]} MD</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 font-semibold">Work completed</h3>
                  {work.length === 0 ? (
                    <p className="text-muted-foreground">{log.activities || "No BOQ quantity recorded."}</p>
                  ) : (
                    <div className="divide-y rounded-md border">
                      {work.map((x) => {
                        const it = itemById.get(x.boqItemId);
                        return (
                          <div key={x.id} className="flex items-center justify-between gap-2 px-3 py-2">
                            <span>{it?.srNo}. {it?.description}{x.remarks && <span className="text-xs text-muted-foreground"> · {x.remarks}</span>}</span>
                            <span className="whitespace-nowrap tabular">{formatNumber(x.qty, 2)} {it?.uom} <span className="text-xs text-muted-foreground">· {formatINR(x.qty * (it?.rate ?? 0))}</span></span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {work.length > 0 && log.activities && <p className="mt-2 text-muted-foreground">Activities: {log.activities}</p>}
                </section>

                {exps.length > 0 && (
                  <section>
                    <h3 className="mb-2 font-semibold">Expenses</h3>
                    <div className="divide-y rounded-md border">
                      {exps.map((x) => (
                        <div key={x.id} className="flex items-center justify-between gap-2 px-3 py-2">
                          <span>{x.category} · {x.description} <span className="text-xs text-muted-foreground">({data.employeeById.get(x.employeeId)?.name})</span></span>
                          <span className="flex items-center gap-2"><span className="tabular">{formatINR(x.amount)}</span><ExpenseStatusBadge status={x.status} /></span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {log.remarks && (
                  <section>
                    <h3 className="mb-1 font-semibold">Remarks</h3>
                    <p className="text-muted-foreground">{log.remarks}</p>
                  </section>
                )}
              </div>
            </DialogContent>
          );
        })()}
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete daily log?"
        description="Its man-days, idle time and BOQ quantities will be removed from the project. Linked expenses are kept."
        confirmLabel="Delete log"
        destructive
        loading={del.isPending}
        onConfirm={() =>
          log &&
          del.mutate(log.id, {
            onSuccess: () => {
              toast.success("Daily log deleted", { description: "Project KPIs recalculated." });
              setConfirm(false);
              onClose();
            },
          })
        }
      />
    </>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-semibold tabular", warn && "text-warning")}>{value}</p>
    </div>
  );
}
