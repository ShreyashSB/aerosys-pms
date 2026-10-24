import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { CurrentUser } from '../auth/current-user.js';
import { can } from '../auth/permissions.js';
import { assertProjectAccess } from '../auth/project-access.js';
import { todayIST } from '../common/dates.js';
import { isForeignKeyViolation } from '../common/pg-errors.js';
import { DB, type Database } from '../db/db.module.js';
import { employees, expenses, projects, type Expense } from '../db/schema.js';
import { findProject } from '../projects/find-project.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { formatINR } from '../common/format.js';
import type { ExpenseInput, ExpenseQuery, ReviewInput } from './expenses.dto.js';

@Injectable()
export class ExpensesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly notifications: NotificationsService,
  ) {}

  /** Newest first, optionally for one project and/or one status. */
  list(q: ExpenseQuery): Promise<Expense[]> {
    return this.db
      .select()
      .from(expenses)
      .where(and(q.projectId ? eq(expenses.projectId, q.projectId) : undefined, q.status ? eq(expenses.status, q.status) : undefined))
      .orderBy(desc(expenses.submittedAt));
  }

  async create(input: ExpenseInput, user: CurrentUser): Promise<Expense> {
    if (input.date > todayIST()) throw new BadRequestException('Expense date cannot be in the future');
    if (input.employeeId !== user.employeeId && !can(user.role, 'expense.createForOthers')) {
      throw new ForbiddenException('You can only submit your own expenses');
    }
    const project = await findProject(this.db, input.projectId);
    await assertProjectAccess(this.db, user, input.projectId);
    let row: Expense;
    try {
      // No code in the insert: the column default takes the next number from the sequence.
      [row] = await this.db.insert(expenses).values(input).returning();
    } catch (err) {
      if (isForeignKeyViolation(err)) throw new BadRequestException('Employee not found');
      throw err;
    }
    const [emp] = await this.db.select({ name: employees.name }).from(employees).where(eq(employees.id, row.employeeId));
    await this.notifications.notify({
      type: 'expense_submitted',
      title: 'Expense submitted for approval',
      message: `${emp?.name ?? 'Someone'} submitted ${row.category} expense of ${formatINR(row.amount)} on ${project.name}.`,
      link: '/expenses?status=pending',
      audienceRoles: ['management', 'accounts'],
      audienceEmployeeIds: [project.managerId],
    });
    return row;
  }

  approve(id: string, input: ReviewInput, reviewerId: string): Promise<Expense> {
    return this.review(id, 'approved', input.note, reviewerId);
  }

  reject(id: string, input: ReviewInput, reviewerId: string): Promise<Expense> {
    if (!input.note) throw new BadRequestException('Please provide a reason for rejection');
    return this.review(id, 'rejected', input.note, reviewerId);
  }

  /**
   * One UPDATE … WHERE status = 'pending'. If two managers press Approve at
   * the same moment, Postgres lets only one of them change the row; the
   * other gets nothing back and a clear message.
   */
  private async review(id: string, status: 'approved' | 'rejected', note: string, reviewerId: string): Promise<Expense> {
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
    if (row) {
      await this.notifyReviewed(row);
      return row;
    }
    const [existing] = await this.db.select({ status: expenses.status }).from(expenses).where(eq(expenses.id, id));
    if (!existing) throw new NotFoundException('Expense not found');
    throw new BadRequestException(`Expense has already been ${existing.status}`);
  }

  /** Tells the claimant; an approved expense also goes to accounts, who pay it. */
  private async notifyReviewed(e: Expense) {
    const [project] = await this.db.select({ name: projects.name }).from(projects).where(eq(projects.id, e.projectId));
    const [reviewer] = e.reviewedById
      ? await this.db.select({ name: employees.name }).from(employees).where(eq(employees.id, e.reviewedById))
      : [];
    const approved = e.status === 'approved';
    await this.notifications.notify({
      type: approved ? 'expense_approved' : 'expense_rejected',
      title: approved ? 'Expense approved' : 'Expense rejected',
      message:
        `${e.code} (${e.category}, ${formatINR(e.amount)}) on ${project?.name ?? 'project'} was ${e.status}` +
        `${reviewer ? ` by ${reviewer.name}` : ''}${e.reviewNote ? ` – “${e.reviewNote}”` : ''}.`,
      link: '/expenses',
      audienceRoles: approved ? ['accounts'] : [],
      audienceEmployeeIds: [e.employeeId],
    });
  }

  /** Only a pending expense can be withdrawn: by the person who claimed it, or by someone who approves expenses on its project. */
  async remove(id: string, user: CurrentUser): Promise<void> {
    const [e] = await this.db.select().from(expenses).where(eq(expenses.id, id));
    if (!e) throw new NotFoundException('Expense not found');
    if (e.employeeId !== user.employeeId) {
      if (!can(user.role, 'expense.approve')) throw new ForbiddenException('You can only withdraw your own expenses');
      await assertProjectAccess(this.db, user, e.projectId);
    }
    const [row] = await this.db
      .delete(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.status, 'pending')))
      .returning({ id: expenses.id });
    if (!row) throw new BadRequestException('Only pending expenses can be withdrawn');
  }
}
