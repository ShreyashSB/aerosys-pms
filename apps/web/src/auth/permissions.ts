import type { Project, ProjectAssignment, Role, User } from "@/types/models";

export type Permission =
  | "dashboard.portfolio" // company-wide dashboard
  | "project.viewAll"
  | "project.create"
  | "project.edit"
  | "project.delete"
  | "project.progress"
  | "project.assign"
  | "project.costs.edit"
  | "finance.view" // contract value, costs, profit
  | "rates.view" // employee daily cost rates & wages
  | "boq.edit"
  | "log.create"
  | "document.upload"
  | "expense.viewAll"
  | "expense.create"
  | "expense.createForOthers"
  | "expense.approve"
  | "instrument.view"
  | "instrument.viewAll"
  | "instrument.manage"
  | "engineer.view"
  | "engineer.manage"
  | "employee.view"
  | "employee.manage"
  | "report.view"
  | "settings.manage";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  management: [
    "dashboard.portfolio", "project.viewAll", "project.create", "project.edit", "project.delete",
    "project.progress", "project.assign", "project.costs.edit", "finance.view", "rates.view",
    "expense.viewAll", "expense.create", "expense.createForOthers", "expense.approve",
    "instrument.view", "instrument.viewAll", "instrument.manage", "engineer.view", "engineer.manage",
    "employee.view", "employee.manage", "report.view", "settings.manage", "boq.edit", "log.create", "document.upload",
  ],
  project_manager: [
    "project.edit", "project.progress", "project.assign", "project.costs.edit", "finance.view",
    "expense.create", "expense.createForOthers", "expense.approve",
    "instrument.view", "instrument.viewAll", "instrument.manage", "engineer.view", "boq.edit", "log.create", "document.upload",
    "rates.view",
  ],
  site_engineer: ["project.progress", "expense.create", "instrument.view"],
  accounts: [
    "dashboard.portfolio", "project.viewAll", "project.costs.edit", "finance.view", "rates.view",
    "expense.viewAll", "expense.create", "expense.createForOthers",
    "employee.view", "employee.manage", "report.view", "document.upload",
  ],
};

export const ROLE_LABELS: Record<Role, string> = {
  management: "Management",
  project_manager: "Project Manager",
  site_engineer: "Site Engineer",
  accounts: "Accounts",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  management: "Full visibility of projects, costs, profitability, people and reports.",
  project_manager: "Own projects, engineer assignments, expense approvals and instruments.",
  site_engineer: "Assigned projects, progress updates, own expenses and instruments.",
  accounts: "Expenses, employees, project costs and financial reports.",
};

export function can(role: Role, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Row-level scoping of projects for the current user.
 * - Management / Accounts: all projects
 * - Project Manager: projects they manage
 * - Site Engineer: projects they are (or were) assigned to
 */
export function scopeProjects(user: User, projects: Project[], assignments: ProjectAssignment[]): Project[] {
  if (can(user.role, "project.viewAll")) return projects;
  if (user.role === "project_manager") return projects.filter((p) => p.managerId === user.employeeId);
  const mine = new Set(assignments.filter((a) => a.employeeId === user.employeeId).map((a) => a.projectId));
  return projects.filter((p) => mine.has(p.id));
}

/** Whether the user can act (edit / approve / assign) on a specific project. */
export function canManageProject(user: User, project: Project) {
  if (user.role === "management") return true;
  return user.role === "project_manager" && project.managerId === user.employeeId;
}
