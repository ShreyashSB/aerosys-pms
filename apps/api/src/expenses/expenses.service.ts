import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { todayIST } from '../common/dates.js';
import { isForeignKeyViolation } from '../common/pg-errors.js';
import { DB, type Database } from '../db/db.module.js';
import { expenses, type Expense } from '../db/schema.js';
import { findProject } from '../projects/find-project.js';
import type { ExpenseInput, ExpenseQuery, ReviewInput } from './expenses.dto.js';

@Injectable()
export class ExpensesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Newest first, optionally for one project and/or one status. */
  list(q: ExpenseQuery): Promise<Expense[]> {
    return this.db
      .select()
      .from(expenses)
      .where(and(q.projectId ? eq(expenses.projectId, q.projectId) : undefined, q.status ? eq(expenses.status, q.status) : undefined))
      .orderBy(desc(expenses.submittedAt));
  }

  async create(input: ExpenseInput): Promise<Expense> {
    if (input.date > todayIST()) throw new BadRequestException('Expense date cannot be in the future');
    await findProject(this.db, input.projectId);
    try {
      // No code in the insert: the column default takes the next number from the sequence.
      const [row] = await this.db.insert(expenses).values(input).returning();
      return row;
    } catch (err) {
      if (isForeignKeyViolation(err)) throw new BadRequestException('Employee not found');
      throw err;
    }
  }

  approve(id: string, input: ReviewInput): Promise<Expense> {
    return this.review(id, 'approved', input);
  }

  reject(id: string, input: ReviewInput): Promise<Expense> {
    if (!input.note) throw new BadRequestException('Please provide a reason for rejection');
    return this.review(id, 'rejected', input);
  }

  /**
   * One UPDATE … WHERE status = 'pending'. If two managers press Approve at
   * the same moment, Postgres lets only one of them change the row; the
   * other gets nothing back and a clear message.
   */
  private async review(id: string, status: 'approved' | 'rejected', { reviewerId, note }: ReviewInput): Promise<Expense> {
    let row: Expense | undefined;
    try {
      [row] = await this.db
        .update(expenses)
        .set({ status, reviewedById: reviewerId, reviewedAt: new Date(), reviewNote: note })
        .where(and(eq(expenses.id, id), eq(expenses.status, 'pending')))
        .returning();
    } catch (err) {
      if (isForeignKeyViolation(err)) throw new BadRequestException('Reviewer not found');
      throw err;
    }
    if (row) return row;
    const [existing] = await this.db.select({ status: expenses.status }).from(expenses).where(eq(expenses.id, id));
    if (!existing) throw new NotFoundException('Expense not found');
    throw new BadRequestException(`Expense has already been ${existing.status}`);
  }

  /** Only a pending expense can be withdrawn. */
  async remove(id: string): Promise<void> {
    const [row] = await this.db
      .delete(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.status, 'pending')))
      .returning({ id: expenses.id });
    if (row) return;
    const [existing] = await this.db.select({ id: expenses.id }).from(expenses).where(eq(expenses.id, id));
    if (!existing) throw new NotFoundException('Expense not found');
    throw new BadRequestException('Only pending expenses can be withdrawn');
  }
}
