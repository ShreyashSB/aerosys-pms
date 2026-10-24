import { ApiError, clone, db, simulateLatency } from "@/api/mockDb";
import { todayISO } from "@/lib/dates";
import { uid } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/types/models";
import { pushNotification } from "./notificationService";

export type ProjectInput = Pick<
  Project,
  | "name" | "clientName" | "site" | "managerId" | "contractValue" | "estimatedCost" | "allottedManDays" | "allottedExpenses"
  | "startDate" | "endDate" | "description" | "status"
>;

function validate(input: ProjectInput) {
  if (!input.name.trim()) throw new ApiError("Project name is required");
  if (input.contractValue <= 0) throw new ApiError("Contract value must be greater than zero");
  if (input.endDate < input.startDate) throw new ApiError("Expected completion must be after start date");
  if (!(input.allottedManDays > 0)) throw new ApiError("Allotted man-days must be greater than zero");
  if (input.allottedExpenses < 0) throw new ApiError("Allotted expenses cannot be negative");
}

export const projectService = {
  // GET /api/projects
  async list(): Promise<Project[]> {
    await simulateLatency();
    return clone(db.read().projects);
  },

  // GET /api/projects/:id
  async get(id: string): Promise<Project> {
    await simulateLatency();
    const p = db.read().projects.find((x) => x.id === id);
    if (!p) throw new ApiError("Project not found", 404);
    return clone(p);
  },

  // POST /api/projects
  async create(input: ProjectInput): Promise<Project> {
    await simulateLatency();
    validate(input);
    return db.write((data) => {
      const seq = Math.max(0, ...data.projects.map((p) => Number(p.code.split("-").pop()) || 0)) + 1;
      const now = new Date().toISOString();
      const project: Project = {
        ...input,
        id: uid("prj"),
        code: `PRJ-${new Date().getFullYear()}-${String(seq).padStart(3, "0")}`,
        periodStart: input.startDate,
        createdAt: now,
        updatedAt: now,
      };
      data.projects.unshift(project);
      pushNotification(data, {
        type: "project_created",
        title: "New project created",
        message: `${project.name} for ${project.clientName} has been created.`,
        link: `/projects/${project.id}`,
        audienceRoles: ["management", "accounts"],
        audienceEmployeeIds: [project.managerId],
      });
      return clone(project);
    });
  },

  // PUT /api/projects/:id
  async update(id: string, input: ProjectInput): Promise<Project> {
    await simulateLatency();
    validate(input);
    return db.write((data) => {
      const p = data.projects.find((x) => x.id === id);
      if (!p) throw new ApiError("Project not found", 404);
      const managerChanged = p.managerId !== input.managerId;
      Object.assign(p, input, { updatedAt: new Date().toISOString() });
      if (input.status === "completed") {
        for (const a of data.assignments) if (a.projectId === p.id && !a.endDate) a.endDate = todayISO();
      }
      if (managerChanged) {
        pushNotification(data, {
          type: "engineer_assigned",
          title: "Project manager assigned",
          message: `You are now the project manager for ${p.name}.`,
          link: `/projects/${p.id}`,
          audienceRoles: [],
          audienceEmployeeIds: [p.managerId],
        });
      }
      return clone(p);
    });
  },

  async setStatus(id: string, status: ProjectStatus): Promise<Project> {
    await simulateLatency();
    return db.write((data) => {
      const p = data.projects.find((x) => x.id === id);
      if (!p) throw new ApiError("Project not found", 404);
      p.status = status;
      p.updatedAt = new Date().toISOString();
      return clone(p);
    });
  },

  // DELETE /api/projects/:id – hard delete, cascades related records.
  async remove(id: string): Promise<void> {
    await simulateLatency();
    db.write((data) => {
      data.projects = data.projects.filter((p) => p.id !== id);
      data.assignments = data.assignments.filter((a) => a.projectId !== id);
      data.expenses = data.expenses.filter((e) => e.projectId !== id);
      data.projectCosts = data.projectCosts.filter((c) => c.projectId !== id);
      data.projectInstruments = data.projectInstruments.filter((pi) => pi.projectId !== id);
      data.boqItems = data.boqItems.filter((b) => b.projectId !== id);
      data.boqExecutions = data.boqExecutions.filter((x) => x.projectId !== id);
      data.dailyLogs = data.dailyLogs.filter((l) => l.projectId !== id);
      data.documents = data.documents.filter((d) => d.projectId !== id);
      for (const ins of data.instruments) {
        if (ins.assignedProjectId === id) {
          ins.assignedProjectId = null;
          ins.assignedEngineerId = null;
          ins.status = "available";
        }
      }
    });
  },
};
