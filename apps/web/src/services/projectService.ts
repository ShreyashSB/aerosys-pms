import { ApiError, clone, db, simulateLatency } from "@/api/mockDb";
import type { Database } from "@/api/seed";
import { todayISO } from "@/lib/dates";
import { uid } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/types/models";
import { pushNotification } from "./notificationService";

export type ProjectInput = Pick<
  Project,
  | "name" | "clientName" | "site" | "projectType" | "workOrderNo" | "poNo" | "managerId" | "contractValue" | "estimatedCost"
  | "allottedManDays" | "allottedExpenses" | "operationalCostPerManDay" | "startDate" | "endDate" | "description" | "status"
> & { /** Project ID; generated when left blank. */ code?: string };

function validate(input: ProjectInput) {
  if (!input.name.trim()) throw new ApiError("Project name is required");
  if (input.contractValue <= 0) throw new ApiError("Contract value must be greater than zero");
  if (input.endDate < input.startDate) throw new ApiError("Expected completion must be after start date");
  if (!(input.allottedManDays > 0)) throw new ApiError("Allotted man-days must be greater than zero");
  if (input.allottedExpenses < 0) throw new ApiError("Allotted expenses cannot be negative");
  if (input.operationalCostPerManDay < 0) throw new ApiError("Operational cost cannot be negative");
  if (!input.projectType.trim()) throw new ApiError("Project type is required");
}

/** Adds a value typed with "Add new" to its dropdown list, ignoring case-only duplicates. */
function remember(list: string[], value: string) {
  const v = value.trim();
  if (v && !list.some((x) => x.toLowerCase() === v.toLowerCase())) {
    list.push(v);
    list.sort((a, b) => a.localeCompare(b));
  }
}

function rememberLookups(data: Database, input: ProjectInput) {
  remember(data.lookups.clients, input.clientName);
  remember(data.lookups.sites, input.site);
  if (!data.lookups.projectTypes.some((t) => t.toLowerCase() === input.projectType.trim().toLowerCase())) data.lookups.projectTypes.push(input.projectType.trim());
}

function checkCode(data: Database, code: string, selfId?: string) {
  if (data.projects.some((p) => p.id !== selfId && p.code.toLowerCase() === code.toLowerCase())) throw new ApiError(`Project ID ${code} is already in use`);
}

export const projectService = {
  // GET /api/lookups – clients, sites and project types for the form dropdowns
  async lookups(): Promise<Database["lookups"]> {
    await simulateLatency();
    return clone(db.read().lookups);
  },

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
      const { code: wanted, ...rest } = input;
      const code = wanted?.trim() || `PRJ-${new Date().getFullYear()}-${String(seq).padStart(3, "0")}`;
      checkCode(data, code);
      rememberLookups(data, input);
      const project: Project = {
        ...rest,
        id: uid("prj"),
        code,
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
      const { code, ...rest } = input;
      if (code?.trim()) {
        checkCode(data, code.trim(), p.id);
        p.code = code.trim();
      }
      rememberLookups(data, input);
      Object.assign(p, rest, { updatedAt: new Date().toISOString() });
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
      data.bills = data.bills.filter((b) => b.projectId !== id);
      data.engineerReviews = data.engineerReviews.filter((r) => r.projectId !== id);
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
