import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { projectCosts, type ProjectCost } from '../db/schema.js';
import { findProject } from '../projects/find-project.js';
import type { ProjectCostInput } from './project-costs.dto.js';

/** Direct costs that aren't expenses or vendor bills, such as sub-contract labour or crane hire. */
@Injectable()
export class ProjectCostsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  list(projectId?: string): Promise<ProjectCost[]> {
    return this.db
      .select()
      .from(projectCosts)
      .where(projectId ? eq(projectCosts.projectId, projectId) : undefined)
      .orderBy(asc(projectCosts.date));
  }

  async create(projectId: string, input: ProjectCostInput): Promise<ProjectCost> {
    await findProject(this.db, projectId);
    const [row] = await this.db.insert(projectCosts).values({ ...input, projectId }).returning();
    return row;
  }

  async remove(id: string): Promise<void> {
    const [row] = await this.db.delete(projectCosts).where(eq(projectCosts.id, id)).returning({ id: projectCosts.id });
    if (!row) throw new NotFoundException('Cost not found');
  }
}
