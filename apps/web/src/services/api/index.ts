/**
 * The same services as `src/services/*Service.ts`, backed by the NestJS API
 * instead of the in-browser demo data. Each one has the exact type of its
 * demo twin, so hooks and pages work with either.
 *
 * Until login and roles exist on the server:
 * - users are worked out from employees (department → role), and a role
 *   picked in the employee form is not saved;
 * - notifications stay empty;
 * - "who did it" ids (reviewer, uploader…) are sent in the request body.
 */
import { http } from "@/api/http";
import { ApiError } from "@/api/mockDb";
import type {
  AppSettings,
  BoqExecution,
  BoqItem,
  DailyLog,
  EngineerReview,
  Employee,
  Expense,
  Instrument,
  Lookups,
  Project,
  ProjectAssignment,
  ProjectBill,
  ProjectCost,
  ProjectDocument,
  ProjectInstrument,
  Role,
  User,
} from "@/types/models";
import type * as demo from "../demo";

type Service<K extends keyof typeof demo> = (typeof demo)[K];

const withoutKey = <T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> => {
  const { [key]: _omit, ...rest } = obj;
  return rest;
};

export const projectService: Service<"projectService"> = {
  lookups: () => http.get<Lookups>("/api/lookups"),
  list: () => http.get<Project[]>("/api/projects"),
  get: (id) => http.get<Project>(`/api/projects/${id}`),
  create: (input) => http.post<Project>("/api/projects", { ...input, code: input.code?.trim() || undefined }),
  update: (id, input) => http.put<Project>(`/api/projects/${id}`, { ...input, code: input.code?.trim() || undefined }),
  setStatus: (id, status) => http.patch<Project>(`/api/projects/${id}/status`, { status }),
  remove: (id) => http.delete(`/api/projects/${id}`),
};

/** Interim roles until the server has users: the department decides. */
function roleFor(e: Employee): Role | null {
  if (e.status === "inactive") return null;
  if (e.department === "Management") return "management";
  if (e.department === "Projects") return "project_manager";
  if (e.department === "Accounts") return "accounts";
  return e.isSiteEngineer ? "site_engineer" : null;
}

export const employeeService: Service<"employeeService"> = {
  list: () => http.get<Employee[]>("/api/employees"),
  async listUsers() {
    const employees = await http.get<Employee[]>("/api/employees");
    return employees.flatMap((e): User[] => {
      const role = roleFor(e);
      return role ? [{ id: `usr_${e.id}`, employeeId: e.id, role, email: e.email }] : [];
    });
  },
  create: (input) => http.post<Employee>("/api/employees", { ...withoutKey(input, "appRole"), code: input.code?.trim() || undefined }),
  update: (id, input) => http.put<Employee>(`/api/employees/${id}`, { ...withoutKey(input, "appRole"), code: input.code?.trim() || undefined }),
};

export const assignmentService: Service<"assignmentService"> = {
  list: () => http.get<ProjectAssignment[]>("/api/assignments"),
  assign: ({ projectId, ...rest }) => http.post<ProjectAssignment>(`/api/projects/${projectId}/assignments`, rest),
  release: (id) => http.delete(`/api/assignments/${id}`),
};

export const boqService: Service<"boqService"> = {
  listItems: () => http.get<BoqItem[]>("/api/boq-items"),
  listExecutions: () => http.get<BoqExecution[]>("/api/boq-executions"),
  createItem: ({ projectId, ...rest }) => http.post<BoqItem>(`/api/projects/${projectId}/boq-items`, rest),
  updateItem: (id, input) => http.put<BoqItem>(`/api/boq-items/${id}`, withoutKey(input, "projectId")),
  deleteItem: (id) => http.delete(`/api/boq-items/${id}`),
  addExecution: ({ boqItemId, date, qty, remarks }) => http.post<BoqExecution>(`/api/boq-items/${boqItemId}/executions`, { date, qty, remarks }),
  deleteExecution: (id) => http.delete(`/api/boq-executions/${id}`),
  closePeriod: async (projectId) => {
    await http.post(`/api/projects/${projectId}/close-period`);
  },
};

export const dailyLogService: Service<"dailyLogService"> = {
  list: () => http.get<DailyLog[]>("/api/daily-logs"),
  save: ({ projectId, ...input }, actorId, logId) => {
    const body = { ...input, createdById: actorId };
    return logId ? http.put<DailyLog>(`/api/daily-logs/${logId}`, body) : http.post<DailyLog>(`/api/projects/${projectId}/daily-logs`, body);
  },
  remove: (id) => http.delete(`/api/daily-logs/${id}`),
};

export const expenseService: Service<"expenseService"> = {
  list: () => http.get<Expense[]>("/api/expenses"),
  create: (input) => http.post<Expense>("/api/expenses", input),
  approve: (id, reviewerId, note = "") => http.patch<Expense>(`/api/expenses/${id}/approve`, { reviewerId, note }),
  reject: (id, reviewerId, note) => http.patch<Expense>(`/api/expenses/${id}/reject`, { reviewerId, note }),
  remove: (id) => http.delete(`/api/expenses/${id}`),
};

export const billService: Service<"billService"> = {
  list: () => http.get<ProjectBill[]>("/api/bills"),
  create: ({ projectId, ...rest }, actorId) => http.post<ProjectBill>(`/api/projects/${projectId}/bills`, { ...rest, createdById: actorId }),
  remove: (id) => http.delete(`/api/bills/${id}`),
};

export const projectCostService: Service<"projectCostService"> = {
  list: () => http.get<ProjectCost[]>("/api/project-costs"),
  create: ({ projectId, ...rest }) => http.post<ProjectCost>(`/api/projects/${projectId}/costs`, rest),
  remove: (id) => http.delete(`/api/project-costs/${id}`),
};

export const instrumentService: Service<"instrumentService"> = {
  list: () => http.get<Instrument[]>("/api/instruments"),
  listDeployments: () => http.get<ProjectInstrument[]>("/api/instrument-deployments"),
  create: (input) => http.post<Instrument>("/api/instruments", { ...input, code: input.code?.trim() || undefined }),
  update: (id, input) => http.put<Instrument>(`/api/instruments/${id}`, { ...input, code: input.code?.trim() || undefined }),
  assign: (id, engineerId, projectId) => http.post<Instrument>(`/api/instruments/${id}/assign`, { engineerId, projectId }),
  returnInstrument: (id) => http.post<Instrument>(`/api/instruments/${id}/return`),
  setStatus: (id, status, notes) => http.patch<Instrument>(`/api/instruments/${id}/status`, { status, notes }),
};

export const documentService: Service<"documentService"> = {
  list: () => http.get<ProjectDocument[]>("/api/documents"),
  upload: ({ projectId, ...rest }, actorId) => http.post<ProjectDocument>(`/api/projects/${projectId}/documents`, { ...rest, uploadedById: actorId }),
  remove: (id) => http.delete(`/api/documents/${id}`),
};

export const reviewService: Service<"reviewService"> = {
  list: () => http.get<EngineerReview[]>("/api/engineer-reviews"),
  saveForProject: (projectId, reviewerId, reviews) => http.put<EngineerReview[]>(`/api/projects/${projectId}/reviews`, { reviewerId, reviews }),
};

export const settingsService: Service<"settingsService"> = {
  get: () => http.get<AppSettings>("/api/settings"),
  update: (input) => http.put<AppSettings>("/api/settings", input),
  resetDemoData: async () => {
    throw new ApiError("On the live database, reload the demo with: pnpm db:seed -- --yes");
  },
};

/** Notifications need to know who is signed in, so they come with login and roles. */
export const notificationService: Service<"notificationService"> = {
  listForUser: async () => [],
  markRead: async () => {},
  markAllRead: async () => {},
  runScheduledChecks: async () => {},
};
