import { clone, db, simulateLatency } from "@/api/mockDb";
import type { Database } from "@/api/seed";
import { addDays, todayISO } from "@/lib/dates";
import { uid } from "@/lib/utils";
import type { AppNotification, User } from "@/types/models";
import { projectProgress } from "./progressEvents";

type NewNotification = Omit<AppNotification, "id" | "createdAt" | "readBy">;

/** Used by other services (server-side in a real system) to raise notifications. */
export function pushNotification(data: Database, n: NewNotification) {
  if (n.dedupeKey && data.notifications.some((x) => x.dedupeKey === n.dedupeKey)) return;
  data.notifications.unshift({ ...n, id: uid("ntf"), createdAt: new Date().toISOString(), readBy: [] });
  // keep storage bounded
  if (data.notifications.length > 200) data.notifications.length = 200;
}

export function isVisibleTo(n: AppNotification, user: User) {
  return n.audienceRoles.includes(user.role) || n.audienceEmployeeIds.includes(user.employeeId);
}

export const notificationService = {
  async listForUser(user: User): Promise<AppNotification[]> {
    await simulateLatency(80, 200);
    return clone(db.read().notifications.filter((n) => isVisibleTo(n, user)));
  },

  async markRead(id: string, userId: string) {
    db.write((data) => {
      const n = data.notifications.find((x) => x.id === id);
      if (n && !n.readBy.includes(userId)) n.readBy.push(userId);
    });
  },

  async markAllRead(user: User) {
    db.write((data) => {
      for (const n of data.notifications) {
        if (isVisibleTo(n, user) && !n.readBy.includes(user.id)) n.readBy.push(user.id);
      }
    });
  },

  /**
   * Stand-in for a scheduled server job: raises "approaching deadline" and
   * "nearing completion" alerts. Deduplicated, so it is safe to run on every load.
   */
  async runScheduledChecks() {
    db.write((data) => {
      const today = todayISO();
      const horizon = addDays(today, data.settings.deadlineAlertDays);
      for (const p of data.projects) {
        if (p.status !== "active") continue;
        const completion = Math.round(projectProgress(data, p.id) * 100);
        if (p.endDate >= today && p.endDate <= horizon && completion < 100) {
          pushNotification(data, {
            type: "project_deadline",
            title: "Project deadline approaching",
            message: `${p.name} is due on ${p.endDate} and is ${completion}% complete.`,
            link: `/projects/${p.id}`,
            audienceRoles: ["management"],
            audienceEmployeeIds: [p.managerId],
            dedupeKey: `deadline:${p.id}:${p.endDate}`,
          });
        }
        if (p.endDate < today && completion < 100) {
          pushNotification(data, {
            type: "project_deadline",
            title: "Project overdue",
            message: `${p.name} passed its expected completion date (${p.endDate}) at ${completion}%.`,
            link: `/projects/${p.id}`,
            audienceRoles: ["management"],
            audienceEmployeeIds: [p.managerId],
            dedupeKey: `overdue:${p.id}:${p.endDate}`,
          });
        }
        if (completion >= 90 && completion < 100) {
          pushNotification(data, {
            type: "project_completion",
            title: "Project nearing completion",
            message: `${p.name} has reached ${completion}% completion. Plan handover & final billing.`,
            link: `/projects/${p.id}`,
            audienceRoles: ["management", "accounts"],
            audienceEmployeeIds: [p.managerId],
            dedupeKey: `near-complete:${p.id}`,
          });
        }
      }
    });
  },
};
