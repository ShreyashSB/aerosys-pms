import type { Database } from "@/api/seed";
import { boqRows } from "@/domain/performance";
import { progressFromBoq } from "@/domain/assumptions";
import { todayISO } from "@/lib/dates";
import { pushNotification } from "./notificationService";

/** Current BOQ-derived progress (0-1) for a project inside a DB transaction. */
export function projectProgress(data: Database, projectId: string) {
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) return 0;
  const rows = boqRows(
    data.boqItems.filter((b) => b.projectId === projectId),
    data.boqExecutions.filter((x) => x.projectId === projectId),
    project.periodStart,
    todayISO(),
  );
  const total = rows.reduce((s, r) => s + r.contractAmount, 0);
  const executed = rows.reduce((s, r) => s + r.executedAmount, 0);
  return progressFromBoq(executed, total);
}

/** Server-side side effect: notify when execution crosses 90% / 100%. */
export function notifyProgressMilestones(data: Database, projectId: string, before: number) {
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) return;
  const after = projectProgress(data, projectId);
  if (after >= 1 && before < 1) {
    pushNotification(data, {
      type: "project_completion",
      title: "BOQ fully executed",
      message: `${project.name} has reached 100% execution against its Annexure. Review for handover & final bill.`,
      link: `/projects/${project.id}?tab=boq`,
      audienceRoles: ["management", "accounts"],
      audienceEmployeeIds: [project.managerId],
    });
  } else if (after >= 0.9 && before < 0.9) {
    pushNotification(data, {
      type: "project_completion",
      title: "Project nearing completion",
      message: `${project.name} has reached ${Math.round(after * 100)}% execution.`,
      link: `/projects/${project.id}`,
      audienceRoles: ["management", "accounts"],
      audienceEmployeeIds: [project.managerId],
    });
  }
}
