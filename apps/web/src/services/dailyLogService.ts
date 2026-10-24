import { ApiError, clone, db, simulateLatency } from "@/api/mockDb";
import { MAN_DAY_WEIGHT, idleManDays } from "@/domain/assumptions";
import { todayISO } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { uid } from "@/lib/utils";
import type { AttendanceEntry, DailyLog, ExpenseCategory } from "@/types/models";
import { pushNotification } from "./notificationService";
import { notifyProgressMilestones, projectProgress } from "./progressEvents";

export interface DailyLogInput {
  projectId: string;
  date: string;
  attendance: AttendanceEntry[];
  activities: string;
  remarks: string;
  work: Array<{ boqItemId: string; qty: number; remarks: string }>;
  /** New expenses raised with this log (created as Pending). */
  expenses: Array<{ employeeId: string; category: ExpenseCategory; amount: number; description: string }>;
}

export const dailyLogService = {
  // GET /api/daily-logs
  async list(): Promise<DailyLog[]> {
    await simulateLatency();
    return clone(db.read().dailyLogs);
  },

  /** POST /api/projects/:id/daily-logs  (or PUT /api/daily-logs/:id when `logId` is given) */
  async save(input: DailyLogInput, actorId: string, logId?: string): Promise<DailyLog> {
    await simulateLatency(200, 450);
    if (!input.date) throw new ApiError("Date is required");
    if (input.date > todayISO()) throw new ApiError("Daily logs cannot be created for future dates");
    if (!input.attendance.length) throw new ApiError("Add at least one person to the attendance");
    const seen = new Set<string>();
    for (const a of input.attendance) {
      if (seen.has(a.employeeId)) throw new ApiError("Each person can appear only once in a log");
      seen.add(a.employeeId);
      if ((a.status === "idle" || a.idleHours > 0) && !a.idleReason) throw new ApiError("Select an idle reason for every idle entry");
      if (a.idleHours < 0) throw new ApiError("Idle hours cannot be negative");
    }
    for (const w of input.work) if (!w.boqItemId || !(w.qty > 0)) throw new ApiError("Each work line needs a BOQ item and a quantity above zero");
    for (const x of input.expenses) if (!(x.amount > 0) || !x.employeeId) throw new ApiError("Each expense needs an employee and an amount");

    return db.write((data) => {
      const project = data.projects.find((p) => p.id === input.projectId);
      if (!project) throw new ApiError("Project not found", 404);
      if (project.status === "completed" || project.status === "archived") throw new ApiError("Project is closed for daily logging");
      if (input.date < project.startDate) throw new ApiError("Date is before the project start date");
      const clash = data.dailyLogs.find((l) => l.projectId === input.projectId && l.date === input.date && l.id !== logId);
      if (clash) throw new ApiError("A daily log already exists for this date – open it to edit");
      const hours = data.settings.hoursPerManDay;
      for (const a of input.attendance) {
        if (a.idleHours > hours) throw new ApiError(`Idle hours cannot exceed ${hours} (one man-day)`);
        if (MAN_DAY_WEIGHT[a.status] === 0) continue;
        const other = data.dailyLogs.find(
          (l) => l.date === input.date && l.id !== logId && l.attendance.some((x) => x.employeeId === a.employeeId && MAN_DAY_WEIGHT[x.status] > 0),
        );
        if (other) {
          const emp = data.employees.find((e) => e.id === a.employeeId);
          const op = data.projects.find((p) => p.id === other.projectId);
          throw new ApiError(`${emp?.name ?? "Employee"} is already logged as working on ${op?.name ?? "another project"} for this date`);
        }
      }

      const before = projectProgress(data, input.projectId);
      const stamp = new Date().toISOString();
      const attendance = input.attendance.map((a) => ({
        ...a,
        idleHours: a.status === "idle" || MAN_DAY_WEIGHT[a.status] === 0 ? 0 : a.idleHours,
        idleReason: a.status === "idle" || a.idleHours > 0 ? a.idleReason : null,
      }));
      let log: DailyLog;
      if (logId) {
        const existing = data.dailyLogs.find((l) => l.id === logId);
        if (!existing) throw new ApiError("Daily log not found", 404);
        Object.assign(existing, { date: input.date, attendance, activities: input.activities, remarks: input.remarks, updatedAt: stamp });
        log = existing;
        data.boqExecutions = data.boqExecutions.filter((x) => x.dailyLogId !== logId);
      } else {
        log = { id: uid("log"), projectId: input.projectId, date: input.date, attendance, activities: input.activities, remarks: input.remarks, createdById: actorId, createdAt: stamp, updatedAt: stamp };
        data.dailyLogs.push(log);
      }
      for (const w of input.work) {
        data.boqExecutions.push({ id: uid("exe"), projectId: input.projectId, boqItemId: w.boqItemId, date: input.date, qty: w.qty, remarks: w.remarks, dailyLogId: log.id });
      }
      let seq = Math.max(1000, ...data.expenses.map((e) => Number(e.code.split("-")[1]) || 0));
      for (const x of input.expenses) {
        data.expenses.unshift({
          id: uid("exp"), code: `EXP-${++seq}`, employeeId: x.employeeId, projectId: input.projectId, category: x.category, amount: x.amount,
          date: input.date, description: x.description || `${x.category} – daily log`, receipt: null, dailyLogId: log.id, status: "pending",
          submittedAt: stamp, reviewedById: null, reviewedAt: null, reviewNote: "",
        });
      }
      if (input.expenses.length) {
        pushNotification(data, {
          type: "expense_submitted",
          title: "Expenses submitted with daily log",
          message: `${input.expenses.length} expense(s) totalling ₹${formatNumber(input.expenses.reduce((s, x) => s + x.amount, 0))} raised on ${project.name} (${input.date}).`,
          link: `/expenses?status=pending&project=${project.id}`,
          audienceRoles: ["management", "accounts"],
          audienceEmployeeIds: [project.managerId],
        });
      }
      const idle = attendance.reduce((s, a) => s + idleManDays(a.status, a.idleHours, hours), 0);
      if (idle >= 2) {
        const reasons = [...new Set(attendance.filter((a) => a.idleReason).map((a) => a.idleReason))].join(", ");
        pushNotification(data, {
          type: "idle_recorded",
          title: "Idle time recorded",
          message: `${formatNumber(idle, 1)} idle man-days logged on ${project.name} for ${input.date} (${reasons}).`,
          link: `/projects/${project.id}?tab=log`,
          audienceRoles: ["management"],
          audienceEmployeeIds: [project.managerId],
          dedupeKey: `idle:${log.id}:${idle}`,
        });
      }
      notifyProgressMilestones(data, input.projectId, before);
      return clone(log);
    });
  },

  // DELETE /api/daily-logs/:id – removes its BOQ quantities; linked expenses are kept
  async remove(id: string): Promise<void> {
    await simulateLatency();
    db.write((data) => {
      data.dailyLogs = data.dailyLogs.filter((l) => l.id !== id);
      data.boqExecutions = data.boqExecutions.filter((x) => x.dailyLogId !== id);
      for (const e of data.expenses) if (e.dailyLogId === id) e.dailyLogId = null;
    });
  },
};
