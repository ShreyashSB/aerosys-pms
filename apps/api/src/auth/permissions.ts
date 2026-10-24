/**
 * Who may do what. The same table as the web app's
 * apps/web/src/auth/permissions.ts; permissions.spec.ts fails if they drift.
 * The web uses it to hide buttons; the API uses it to refuse requests,
 * which is what actually protects the data.
 */
export const ROLES = ['management', 'project_manager', 'site_engineer', 'accounts'] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | 'dashboard.portfolio'
  | 'project.viewAll'
  | 'project.create'
  | 'project.edit'
  | 'project.delete'
  | 'project.progress'
  | 'project.assign'
  | 'project.costs.edit'
  | 'finance.view'
  | 'rates.view'
  | 'boq.edit'
  | 'log.create'
  | 'document.upload'
  | 'expense.viewAll'
  | 'expense.create' // Accounts only: a recorded expense counts at once, there is no approval step
  | 'instrument.view'
  | 'instrument.viewAll'
  | 'instrument.manage'
  | 'engineer.view'
  | 'engineer.manage'
  | 'employee.view'
  | 'employee.manage'
  | 'report.view'
  | 'engineer.review'
  | 'bill.manage'
  | 'settings.manage';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  management: [
    'dashboard.portfolio', 'project.viewAll', 'project.create', 'project.edit', 'project.delete',
    'project.progress', 'project.assign', 'finance.view', 'rates.view',
    'expense.viewAll',
    'instrument.view', 'instrument.viewAll', 'instrument.manage', 'engineer.view', 'engineer.manage',
    'employee.view', 'employee.manage', 'report.view', 'settings.manage', 'boq.edit', 'log.create', 'document.upload',
    'engineer.review',
  ],
  project_manager: [
    'project.edit', 'project.progress', 'project.assign', 'finance.view',
    'instrument.view', 'instrument.viewAll', 'instrument.manage', 'engineer.view', 'boq.edit', 'log.create', 'document.upload',
    'rates.view', 'engineer.review',
  ],
  site_engineer: ['project.progress', 'instrument.view'],
  accounts: [
    'dashboard.portfolio', 'project.viewAll', 'project.costs.edit', 'finance.view', 'rates.view',
    'expense.viewAll', 'expense.create',
    'employee.view', 'employee.manage', 'report.view', 'document.upload', 'bill.manage',
  ],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
