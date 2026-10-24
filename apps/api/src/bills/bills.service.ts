import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { isForeignKeyViolation, isUniqueViolation } from '../common/pg-errors.js';
import { DB, type Database } from '../db/db.module.js';
import { projectBills, type ProjectBill } from '../db/schema.js';
import { findProject } from '../projects/find-project.js';
import type { BillInput } from './bills.dto.js';

/** Vendor bills and client invoices on a project (the Bills & invoices tab). */
@Injectable()
export class BillsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  list(projectId?: string): Promise<ProjectBill[]> {
    return this.db
      .select()
      .from(projectBills)
      .where(projectId ? eq(projectBills.projectId, projectId) : undefined)
      .orderBy(desc(projectBills.date));
  }

  async create(projectId: string, input: BillInput): Promise<ProjectBill> {
    await findProject(this.db, projectId);
    return this.run(input, async () => {
      const [row] = await this.db.insert(projectBills).values({ ...input, projectId }).returning();
      return row;
    });
  }

  async update(id: string, input: BillInput): Promise<ProjectBill> {
    const row = await this.run(input, async () => {
      const [r] = await this.db.update(projectBills).set(input).where(eq(projectBills.id, id)).returning();
      return r;
    });
    if (!row) throw new NotFoundException('Bill not found');
    return row;
  }

  async remove(id: string): Promise<void> {
    const [row] = await this.db.delete(projectBills).where(eq(projectBills.id, id)).returning({ id: projectBills.id });
    if (!row) throw new NotFoundException('Bill not found');
  }

  /** The unique index on (project, kind, lower(number)) catches a repeated number. */
  private async run<T>(input: BillInput, write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (err) {
      const label = input.kind === 'vendor_bill' ? 'vendor bill' : 'invoice';
      if (isUniqueViolation(err)) throw new ConflictException(`This ${label} number is already recorded on the project`);
      if (isForeignKeyViolation(err)) throw new BadRequestException('Employee not found');
      throw err;
    }
  }
}
