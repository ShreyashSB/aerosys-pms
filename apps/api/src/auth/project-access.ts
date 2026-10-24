import { ForbiddenException, NotFoundException, SetMetadata } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../db/db.module.js';
import { assignments, boqExecutions, boqItems, dailyLogs, engineerReviews, expenses, projectBills, projectCosts, projectDocuments, projects } from '../db/schema.js';
import type { CurrentUser } from './current-user.js';

/**
 * Row-level rule on top of role permissions: whose projects can you change?
 * - Management and Accounts: any project.
 * - Project managers: projects they manage.
 * - Site engineers: projects they are (or were) assigned to.
 */
export async function canActOnProject(db: Database, user: CurrentUser, projectId: string): Promise<boolean> {
  if (user.role === 'management' || user.role === 'accounts') return true;
  const [p] = await db.select({ managerId: projects.managerId }).from(projects).where(eq(projects.id, projectId));
  if (!p) throw new NotFoundException('Project not found');
  if (user.role === 'project_manager') return p.managerId === user.employeeId;
  const [a] = await db
    .select({ id: assignments.id })
    .from(assignments)
    .where(and(eq(assignments.projectId, projectId), eq(assignments.employeeId, user.employeeId)))
    .limit(1);
  return Boolean(a);
}

export async function assertProjectAccess(db: Database, user: CurrentUser, projectId: string) {
  if (!(await canActOnProject(db, user, projectId))) throw new ForbiddenException('This is not one of your projects');
}

/** Tables whose rows belong to a project. The guard looks up the row's project_id. */
const OWNED = {
  projects,
  assignments,
  boqItems,
  boqExecutions,
  dailyLogs,
  expenses,
  projectBills,
  projectCosts,
  projectDocuments,
  engineerReviews,
};
export type ProjectOwned = keyof typeof OWNED;

export interface ProjectScopeMeta {
  /** Route parameter holding the id. */
  param: string;
  /** Which table that id belongs to; `projects` means the id is the project. */
  table: ProjectOwned;
}

export const PROJECT_SCOPE = 'projectScope';
/**
 * `@ProjectScope('id', 'dailyLogs')` on a route: before it runs, AuthGuard
 * finds the daily log's project and checks the signed-in person may act on it.
 */
export const ProjectScope = (param: string, table: ProjectOwned) => SetMetadata(PROJECT_SCOPE, { param, table } satisfies ProjectScopeMeta);

/** The project a route's target row belongs to, or 404 if the row doesn't exist. */
export async function projectIdFor(db: Database, { table }: ProjectScopeMeta, id: string): Promise<string> {
  if (table === 'projects') return id;
  const t = OWNED[table];
  const [row] = await db.select({ projectId: t.projectId }).from(t).where(eq(t.id, id));
  if (!row) throw new NotFoundException('Not found');
  return row.projectId;
}
