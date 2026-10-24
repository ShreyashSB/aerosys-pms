import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { todayIST } from '../common/dates.js';
import { isUniqueViolation } from '../common/pg-errors.js';
import { DB, type Database } from '../db/db.module.js';
import { assignments, employees, type Assignment } from '../db/schema.js';
import { findProject, isClosed } from '../projects/find-project.js';
import type { AssignmentInput } from './assignments.dto.js';

@Injectable()
export class AssignmentsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** All assignments, or one project's when `projectId` is given. */
  list(projectId?: string): Promise<Assignment[]> {
    return this.db
      .select()
      .from(assignments)
      .where(projectId ? eq(assignments.projectId, projectId) : undefined)
      .orderBy(asc(assignments.startDate));
  }

  async assign(projectId: string, input: AssignmentInput): Promise<Assignment> {
    const project = await findProject(this.db, projectId);
    if (isClosed(project)) throw new BadRequestException('Cannot assign engineers to a closed project');
    const [emp] = await this.db.select().from(employees).where(eq(employees.id, input.employeeId));
    if (!emp) throw new BadRequestException('Engineer not found');
    try {
      const [row] = await this.db.insert(assignments).values({ ...input, projectId }).returning();
      return row;
    } catch (err) {
      // The partial unique index allows only one open assignment per person per project.
      if (isUniqueViolation(err)) throw new ConflictException(`${emp.name} is already assigned to this project`);
      throw err;
    }
  }

  /**
   * DELETE /api/assignments/:id releases the engineer. The row keeps an end
   * date so the history stays; one that starts today or later is removed.
   */
  async release(id: string): Promise<void> {
    const [a] = await this.db.select().from(assignments).where(eq(assignments.id, id));
    if (!a) throw new NotFoundException('Assignment not found');
    const today = todayIST();
    if (a.startDate >= today) await this.db.delete(assignments).where(eq(assignments.id, id));
    else await this.db.update(assignments).set({ endDate: today }).where(eq(assignments.id, id));
  }
}

/** Ends every open assignment on a project today. Used when the project is completed. */
export function closeOpenAssignments(db: Pick<Database, 'update'>, projectId: string) {
  return db
    .update(assignments)
    .set({ endDate: todayIST() })
    .where(and(eq(assignments.projectId, projectId), isNull(assignments.endDate)));
}
