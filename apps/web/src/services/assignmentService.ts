import { ApiError, clone, db, simulateLatency } from "@/api/mockDb";
import { todayISO } from "@/lib/dates";
import { uid } from "@/lib/utils";
import type { ProjectAssignment } from "@/types/models";
import { pushNotification } from "./notificationService";

export type AssignmentInput = Pick<ProjectAssignment, "projectId" | "employeeId" | "role" | "allocation" | "startDate">;

export const assignmentService = {
  // GET /api/assignments
  async list(): Promise<ProjectAssignment[]> {
    await simulateLatency();
    return clone(db.read().assignments);
  },

  // POST /api/projects/:id/assignments
  async assign(input: AssignmentInput): Promise<ProjectAssignment> {
    await simulateLatency();
    return db.write((data) => {
      const project = data.projects.find((p) => p.id === input.projectId);
      const emp = data.employees.find((e) => e.id === input.employeeId);
      if (!project || !emp) throw new ApiError("Project or engineer not found", 404);
      if (project.status === "completed" || project.status === "archived")
        throw new ApiError("Cannot assign engineers to a closed project");
      if (data.assignments.some((a) => a.projectId === input.projectId && a.employeeId === input.employeeId && !a.endDate))
        throw new ApiError(`${emp.name} is already assigned to this project`);
      if (input.allocation <= 0 || input.allocation > 100) throw new ApiError("Allocation must be between 1 and 100%");
      const assignment: ProjectAssignment = { ...input, id: uid("asg"), endDate: null };
      data.assignments.push(assignment);
      pushNotification(data, {
        type: "engineer_assigned",
        title: "Engineer assigned",
        message: `${emp.name} has been assigned to ${project.name} as ${input.role} (${input.allocation}%).`,
        link: `/projects/${project.id}`,
        audienceRoles: ["management"],
        audienceEmployeeIds: [emp.id, project.managerId],
      });
      return clone(assignment);
    });
  },

  /**
   * DELETE /api/assignments/:id – releases the engineer. The record is kept with
   * an end date so the assignment history is preserved.
   * Assignments that started today (no cost incurred) are removed entirely.
   */
  async release(id: string): Promise<void> {
    await simulateLatency();
    db.write((data) => {
      const a = data.assignments.find((x) => x.id === id);
      if (!a) throw new ApiError("Assignment not found", 404);
      const today = todayISO();
      if (a.startDate >= today) data.assignments = data.assignments.filter((x) => x.id !== id);
      else a.endDate = today;
    });
  },
};
