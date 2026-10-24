import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import type { CurrentUser } from '../auth/current-user.js';
import { assertProjectAccess } from '../auth/project-access.js';
import { todayIST } from '../common/dates.js';
import { isForeignKeyViolation } from '../common/pg-errors.js';
import { DB, type Database } from '../db/db.module.js';
import { expenses, type Expense } from '../db/schema.js';
import { findProject } from '../projects/find-project.js';
import type { ExpenseInput, ExpenseQuery } from './expenses.dto.js';

@Injectable()
export class ExpensesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Newest first, optionally for one project. */
  list(q: ExpenseQuery): Promise<Expense[]> {
    return this.db
      .select()
      .from(expenses)
      .where(q.projectId ? eq(expenses.projectId, q.projectId) : undefined)
      .orderBy(desc(expenses.submittedAt));
  }

  async create(input: ExpenseInput, user: CurrentUser): Promise<Expense> {
    if (input.date > todayIST()) throw new BadRequestException('Expense date cannot be in the future');
    await findProject(this.db, input.projectId);
    await assertProjectAccess(this.db, user, input.projectId);
    try {
      // No code in the insert: the column default takes the next number from the sequence.
      const [row] = await this.db.insert(expenses).values(input).returning();
      return row;
    } catch (err) {
      if (isForeignKeyViolation(err)) throw new BadRequestException('Employee not found');
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const [row] = await this.db.delete(expenses).where(eq(expenses.id, id)).returning({ id: expenses.id });
    if (!row) throw new NotFoundException('Expense not found');
  }
}
