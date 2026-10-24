import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { assignments } from '../db/schema.js';
import type { CurrentUser } from './current-user.js';
import { can } from './permissions.js';

/**
 * What one signed-in person may *read*. Write routes are protected by
 * @Allow and @ProjectScope; this is the matching rule for GET routes, so a
 * site engineer's phone never receives contract values, wage rates or other
 * sites' logs, even though the web app would hide them anyway.
 *
 * - Site engineers see only projects they are or were assigned to, and only
 *   their own expenses.
 * - Without `finance.view`: no contract, budget or cost figures, no bills,
 *   no other project costs, no instrument asset values.
 * - Without `rates.view`: employees' daily cost rates are blanked.
 * - Without `engineer.view`: no engineer reviews.
 *
 * Blanked numbers come back as 0 rather than being removed, so the web app's
 * types stay the same; the screens that would show them are hidden by role.
 */
export class ReadScope {
  constructor(
    readonly user: CurrentUser,
    /** null means every project. */
    private readonly projectIds: Set<string> | null,
  ) {}

  get finance() {
    return can(this.user.role, 'finance.view');
  }
  get rates() {
    return can(this.user.role, 'rates.view');
  }
  get reviews() {
    return can(this.user.role, 'engineer.view');
  }

  sees(projectId: string): boolean {
    return this.projectIds === null || this.projectIds.has(projectId);
  }

  /** Keeps only rows of visible projects. */
  filter<T extends { projectId: string }>(rows: T[]): T[] {
    return this.projectIds === null ? rows : rows.filter((r) => this.projectIds!.has(r.projectId));
  }

  /** Keeps only the visible projects themselves. */
  filterProjects<T extends { id: string }>(projects: T[]): T[] {
    return this.projectIds === null ? projects : projects.filter((p) => this.projectIds!.has(p.id));
  }

  /** For GET /:id routes: someone else's project looks the same as a missing one. */
  assertSees(projectId: string, what = 'Project'): void {
    if (!this.sees(projectId)) throw new NotFoundException(`${what} not found`);
  }
}

@Injectable()
export class ReadScopeService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async for(user: CurrentUser): Promise<ReadScope> {
    if (user.role !== 'site_engineer') return new ReadScope(user, null);
    const rows = await this.db.selectDistinct({ projectId: assignments.projectId }).from(assignments).where(eq(assignments.employeeId, user.employeeId));
    return new ReadScope(user, new Set(rows.map((r) => r.projectId)));
  }
}
