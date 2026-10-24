/**
 * The same services as `src/services/*Service.ts`, backed by the NestJS API
 * instead of the in-browser demo data. Each one has the exact type of its
 * demo twin, so hooks and pages work with either.
 *
 * The server works out "who did it" (author, reviewer, uploader) from the
 * sign-in token, so the actor ids the demo services take are not sent.
 * Notifications stay empty until the server sends them.
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
import type { EmployeeInput } from "../employeeService";

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

const toApiEmployee = (input: EmployeeInput) => {
  const { appRole: _role, password: _password, ...rest } = input;
  return { ...rest, code: input.code?.trim() || undefined };
};

/**
 * Brings the employee's login in line with the form's "System access" field:
 * create it (with the starting password), change its role, switch it off or
 * back on, and reset the password when a new one was typed.
 */
async function syncLogin(employeeId: string, role: Role | null, password?: string) {
  const users = await http.get<User[]>("/api/users");
  const login = users.find((u) => u.employeeId === employeeId);
  if (!login) {
    if (!role) return;
    if (!password) throw new ApiError("Set a starting password to give this person a login");
    await http.post("/api/users", { employeeId, role, password });
    return;
  }
  const active = role !== null;
  if (login.role !== (role ?? login.role) || login.active !== active) {
    await http.put(`/api/users/${login.id}`, { role: role ?? login.role, active });
  }
  if (active && password) await http.post(`/api/users/${login.id}/reset-password`, { password });
}

export const employeeService: Service<"employeeService"> = {
  list: () => http.get<Employee[]>("/api/employees"),
  listUsers: () => http.get<User[]>("/api/users"),
  async create(input) {
    const employee = await http.post<Employee>("/api/employees", toApiEmployee(input));
    await syncLogin(employee.id, input.appRole, input.password);
    return employee;
  },
  async update(id, input) {
    const employee = await http.put<Employee>(`/api/employees/${id}`, toApiEmployee(input));
    await syncLogin(id, input.appRole, input.password);
    return employee;
  },
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
  save: ({ projectId, ...body }, _actorId, logId) => {
    return logId ? http.put<DailyLog>(`/api/daily-logs/${logId}`, body) : http.post<DailyLog>(`/api/projects/${projectId}/daily-logs`, body);
  },
  remove: (id) => http.delete(`/api/daily-logs/${id}`),
};

export const expenseService: Service<"expenseService"> = {
  list: () => http.get<Expense[]>("/api/expenses"),
  create: (input) => http.post<Expense>("/api/expenses", input),
  approve: (id, _reviewerId, note = "") => http.patch<Expense>(`/api/expenses/${id}/approve`, { note }),
  reject: (id, _reviewerId, note) => http.patch<Expense>(`/api/expenses/${id}/reject`, { note }),
  remove: (id) => http.delete(`/api/expenses/${id}`),
};

export const billService: Service<"billService"> = {
  list: () => http.get<ProjectBill[]>("/api/bills"),
  create: ({ projectId, ...rest }) => http.post<ProjectBill>(`/api/projects/${projectId}/bills`, rest),
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
  upload: ({ projectId, ...rest }) => http.post<ProjectDocument>(`/api/projects/${projectId}/documents`, rest),
  remove: (id) => http.delete(`/api/documents/${id}`),
};

export const reviewService: Service<"reviewService"> = {
  list: () => http.get<EngineerReview[]>("/api/engineer-reviews"),
  saveForProject: (projectId, _reviewerId, reviews) => http.put<EngineerReview[]>(`/api/projects/${projectId}/reviews`, { reviews }),
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
