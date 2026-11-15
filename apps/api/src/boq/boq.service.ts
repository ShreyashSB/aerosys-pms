import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, ne, sql, sum } from 'drizzle-orm';
import { todayIST } from '../common/dates.js';
import { DB, type Database } from '../db/db.module.js';
import { boqExecutions, boqItems, projects, type BoqExecution, type BoqItem } from '../db/schema.js';
import { findProject } from '../projects/find-project.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { BoqItemInput, ExecutionInput } from './boq.dto.js';

/** Quantities are decimals; ignore float noise when comparing them. */
export const QTY_TOLERANCE = 1e-6;

/** The Annexure (BOQ items) and the quantities executed against it. */
@Injectable()
export class BoqService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly notifications: NotificationsService,
  ) {}

  listItems(projectId?: string): Promise<BoqItem[]> {
    return this.db
      .select()
      .from(boqItems)
      .where(projectId ? eq(boqItems.projectId, projectId) : undefined)
      .orderBy(asc(boqItems.createdAt));
  }

  listExecutions(projectId?: string): Promise<BoqExecution[]> {
    return this.db
      .select()
      .from(boqExecutions)
      .where(projectId ? eq(boqExecutions.projectId, projectId) : undefined)
      .orderBy(asc(boqExecutions.date));
  }

  /** Serial numbers identify rows on the Annexure, so each one is used once per project. */
  private async assertSrNoFree(projectId: string, srNo: string, exceptId?: string) {
    const [clash] = await this.db
      .select({ id: boqItems.id })
      .from(boqItems)
      .where(and(eq(boqItems.projectId, projectId), sql`lower(trim(${boqItems.srNo})) = lower(trim(${srNo}))`, exceptId ? ne(boqItems.id, exceptId) : undefined))
      .limit(1);
    if (clash) throw new ConflictException(`Sr. no. ${srNo} is already used by another item on this project`);
  }

  async createItem(projectId: string, input: BoqItemInput): Promise<BoqItem> {
    await findProject(this.db, projectId);
    await this.assertSrNoFree(projectId, input.srNo);
    const [row] = await this.db.insert(boqItems).values({ ...input, projectId }).returning();
    return row;
  }

  async updateItem(id: string, input: BoqItemInput): Promise<BoqItem> {
    const [current] = await this.db.select().from(boqItems).where(eq(boqItems.id, id));
    if (!current) throw new NotFoundException('BOQ item not found');
    await this.assertSrNoFree(current.projectId, input.srNo, id);
    const [{ executed }] = await this.db.select({ executed: sum(boqExecutions.qty).mapWith(Number) }).from(boqExecutions).where(eq(boqExecutions.boqItemId, id));
    if (input.contractQty < (executed ?? 0) - QTY_TOLERANCE) {
      throw new BadRequestException(`Contract quantity cannot be below the ${executed} already executed`);
    }
    const [row] = await this.db.update(boqItems).set(input).where(eq(boqItems.id, id)).returning();
    if (!row) throw new NotFoundException('BOQ item not found');
    return row;
  }

  /** Deleting an item also deletes its executed quantities (ON DELETE CASCADE). */
  async deleteItem(id: string): Promise<void> {
    const [row] = await this.db.delete(boqItems).where(eq(boqItems.id, id)).returning({ id: boqItems.id });
    if (!row) throw new NotFoundException('BOQ item not found');
  }

  async addExecution(itemId: string, input: ExecutionInput): Promise<BoqExecution> {
    if (input.date > todayIST()) throw new BadRequestException('Execution date cannot be in the future');
    const [item] = await this.db.select().from(boqItems).where(eq(boqItems.id, itemId));
    if (!item) throw new NotFoundException('BOQ item not found');
    // SUM in the database: Postgres adds the quantities, we only read the total.
    const [{ executed }] = await this.db
      .select({ executed: sum(boqExecutions.qty).mapWith(Number) })
      .from(boqExecutions)
      .where(eq(boqExecutions.boqItemId, itemId));
    if ((executed ?? 0) + input.qty < 0) throw new BadRequestException('Correction would make executed quantity negative');
    // Earned value and progress come from executed quantity, so it may not run past the contract line.
    if (input.qty > 0 && (executed ?? 0) + input.qty > item.contractQty + QTY_TOLERANCE) {
      const balance = Math.max(0, item.contractQty - (executed ?? 0));
      throw new BadRequestException(`This would exceed the contract quantity (balance ${balance} ${item.uom}). Raise the contract quantity first if a variation order applies.`);
    }
    const before = await this.notifications.progressOf(item.projectId);
    const [row] = await this.db
      .insert(boqExecutions)
      .values({ ...input, boqItemId: itemId, projectId: item.projectId })
      .returning();
    await this.notifications.progressMilestones(item.projectId, before);
    return row;
  }

  /** Manual entries only: quantities from a daily log are changed by editing the log. */
  async deleteExecution(id: string): Promise<void> {
    const [x] = await this.db.select().from(boqExecutions).where(eq(boqExecutions.id, id));
    if (!x) throw new NotFoundException('Entry not found');
    if (x.dailyLogId) throw new BadRequestException('This quantity came from a daily log – edit the log instead');
    await this.db.delete(boqExecutions).where(eq(boqExecutions.id, id));
  }

  /** Close the measurement (RA bill) period: from today, quantities count as "current". */
  async closePeriod(projectId: string): Promise<void> {
    await findProject(this.db, projectId);
    await this.db.update(projects).set({ periodStart: todayIST() }).where(eq(projects.id, projectId));
  }
}
