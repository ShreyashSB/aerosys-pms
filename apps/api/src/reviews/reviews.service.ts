import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import { isForeignKeyViolation } from '../common/pg-errors.js';
import { DB, type Database } from '../db/db.module.js';
import { engineerReviews, type EngineerReview } from '../db/schema.js';
import { findProject } from '../projects/find-project.js';
import type { ReviewsInput } from './reviews.dto.js';

/** PM reviews of engineers, given once a project is completed. */
@Injectable()
export class ReviewsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  list(q: { projectId?: string; employeeId?: string }): Promise<EngineerReview[]> {
    const where = q.projectId ? eq(engineerReviews.projectId, q.projectId) : q.employeeId ? eq(engineerReviews.employeeId, q.employeeId) : undefined;
    return this.db.select().from(engineerReviews).where(where).orderBy(asc(engineerReviews.createdAt));
  }

  /**
   * An "upsert": INSERT … ON CONFLICT (project_id, employee_id) DO UPDATE.
   * Reviewing the same engineer again on the same project changes the earlier
   * review instead of adding a second one.
   */
  async saveForProject(projectId: string, { reviewerId, reviews }: ReviewsInput): Promise<EngineerReview[]> {
    const project = await findProject(this.db, projectId);
    if (project.status !== 'completed') throw new BadRequestException('Engineers are reviewed once the project is completed');
    try {
      return await this.db
        .insert(engineerReviews)
        .values(reviews.map((r) => ({ ...r, projectId, reviewerId })))
        .onConflictDoUpdate({
          target: [engineerReviews.projectId, engineerReviews.employeeId],
          // `excluded` is the row we tried to insert.
          set: {
            rating: sql`excluded.rating`,
            comments: sql`excluded.comments`,
            reviewerId: sql`excluded.reviewer_id`,
            updatedAt: sql`now()`,
          },
        })
        .returning();
    } catch (err) {
      if (isForeignKeyViolation(err)) throw new BadRequestException('Engineer or reviewer not found');
      throw err;
    }
  }
}
