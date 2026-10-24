import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq, sum } from 'drizzle-orm';
import { todayIST } from '../common/dates.js';
import { DB, type Database } from '../db/db.module.js';
import { boqExecutions, boqItems, projects, type BoqExecution, type BoqItem } from '../db/schema.js';
import { findProject } from '../projects/find-project.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { BoqItemInput, ExecutionInput } from './boq.dto.js';

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

  async createItem(projectId: string, input: BoqItemInput): Promise<BoqItem> {
    await findProject(this.db, projectId);
    const [row] = await this.db.insert(boqItems).values({ ...input, projectId }).returning();
    return row;
  }

  async updateItem(id: string, input: BoqItemInput): Promise<BoqItem> {
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
