import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import type { CurrentUser } from '../auth/current-user.js';
import { todayIST } from '../common/dates.js';
import { DB, type Database } from '../db/db.module.js';
import { notificationReads, notifications, projects, settings } from '../db/schema.js';
import { progressByProject, projectProgress } from './progress.js';

export const NOTIFICATION_TYPES = [
  'project_created',
  'engineer_assigned',
  'instrument_assigned',
  'project_deadline',
  'project_completion',
  'idle_recorded',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NewNotification {
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  audienceRoles: string[];
  audienceEmployeeIds: string[];
  dedupeKey?: string;
}

/** What the web app's `AppNotification` expects. `readBy` holds the caller's own id when they've read it. */
export interface NotificationDto extends Omit<NewNotification, 'dedupeKey'> {
  id: string;
  createdAt: Date;
  readBy: string[];
  dedupeKey: string | null;
}

/** The daily check runs at most this often (per server process). */
const CHECK_EVERY_MS = 60 * 60 * 1000;
const LIST_LIMIT = 100;

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);
  private lastCheck = 0;

  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Raises a notification. Called by other services after their own write
   * succeeded. It never throws: the expense is already saved, and a failed
   * notification shouldn't turn that into an error for the person saving it.
   * A repeated `dedupeKey` is skipped by the unique index (ON CONFLICT DO NOTHING).
   */
  async notify(n: NewNotification): Promise<void> {
    try {
      await this.db.insert(notifications).values(n).onConflictDoNothing({ target: notifications.dedupeKey });
    } catch (err) {
      this.log.warn(`Could not save notification "${n.title}": ${(err as Error).message}`);
    }
  }

  /** Newest first: everything sent to the caller's role or to them by name. */
  async listForUser(user: CurrentUser): Promise<NotificationDto[]> {
    await this.runChecksIfDue();
    const rows = await this.db
      .select({ n: notifications, readAt: notificationReads.readAt })
      .from(notifications)
      .leftJoin(notificationReads, and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, user.id)))
      .where(visibleTo(user))
      .orderBy(desc(notifications.createdAt))
      .limit(LIST_LIMIT);
    return rows.map(({ n, readAt }) => ({ ...n, type: n.type as NotificationType, readBy: readAt ? [user.id] : [] }));
  }

  async markRead(id: string, user: CurrentUser): Promise<void> {
    const [n] = await this.db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.id, id), visibleTo(user)));
    if (!n) throw new NotFoundException('Notification not found');
    await this.db.insert(notificationReads).values({ notificationId: id, userId: user.id }).onConflictDoNothing();
  }

  /** One INSERT … SELECT: Postgres copies every visible id into notification_reads itself. */
  async markAllRead(user: CurrentUser): Promise<void> {
    await this.db
      .insert(notificationReads)
      .select(
        this.db
          .select({ notificationId: notifications.id, userId: sql`${user.id}::uuid`.as('user_id'), readAt: sql`now()`.as('read_at') })
          .from(notifications)
          .where(visibleTo(user)),
      )
      .onConflictDoNothing();
  }

  /**
   * Deadline and near-completion alerts. A real cron job would run this
   * daily, but Render's free plan has no cron and sleeps when idle, so it
   * runs when someone opens their notifications, at most once an hour.
   * The dedupe keys make running it again harmless.
   */
  async runChecksIfDue(now = Date.now()): Promise<void> {
    if (now - this.lastCheck < CHECK_EVERY_MS) return;
    this.lastCheck = now;
    try {
      await this.runChecks();
    } catch (err) {
      this.log.warn(`Scheduled checks failed: ${(err as Error).message}`);
    }
  }

  async runChecks(): Promise<void> {
    const today = todayIST();
    const [s] = await this.db.select({ days: settings.deadlineAlertDays }).from(settings);
    const horizon = addDays(today, s?.days ?? 14);
    const active = await this.db
      .select({ id: projects.id, name: projects.name, endDate: projects.endDate, managerId: projects.managerId })
      .from(projects)
      .where(eq(projects.status, 'active'));
    const progress = await progressByProject(this.db, active.map((p) => p.id));

    for (const p of active) {
      const completion = Math.round((progress.get(p.id) ?? 0) * 100);
      const base = { link: `/projects/${p.id}`, audienceEmployeeIds: [p.managerId] };
      if (p.endDate >= today && p.endDate <= horizon && completion < 100) {
        await this.notify({
          ...base,
          type: 'project_deadline',
          title: 'Project deadline approaching',
          message: `${p.name} is due on ${p.endDate} and is ${completion}% complete.`,
          audienceRoles: ['management'],
          dedupeKey: `deadline:${p.id}:${p.endDate}`,
        });
      }
      if (p.endDate < today && completion < 100) {
        await this.notify({
          ...base,
          type: 'project_deadline',
          title: 'Project overdue',
          message: `${p.name} passed its expected completion date (${p.endDate}) at ${completion}%.`,
          audienceRoles: ['management'],
          dedupeKey: `overdue:${p.id}:${p.endDate}`,
        });
      }
      if (completion >= 90 && completion < 100) {
        await this.notify({
          ...base,
          type: 'project_completion',
          title: 'Project nearing completion',
          message: `${p.name} has reached ${completion}% completion. Plan handover & final billing.`,
          audienceRoles: ['management', 'accounts'],
          dedupeKey: `near-complete:${p.id}`,
        });
      }
    }
  }

  /**
   * Called after BOQ quantities change: tells management and accounts when a
   * project crosses 90% or 100%. `before` is the progress read before the change.
   */
  async progressMilestones(projectId: string, before: number): Promise<void> {
    const after = await projectProgress(this.db, projectId);
    const done = after >= 1 && before < 1;
    const nearly = !done && after >= 0.9 && before < 0.9;
    if (!done && !nearly) return;
    const [p] = await this.db.select({ name: projects.name, managerId: projects.managerId }).from(projects).where(eq(projects.id, projectId));
    if (!p) return;
    await this.notify({
      type: 'project_completion',
      title: done ? 'BOQ fully executed' : 'Project nearing completion',
      message: done
        ? `${p.name} has reached 100% execution against its Annexure. Review for handover & final bill.`
        : `${p.name} has reached ${Math.round(after * 100)}% execution.`,
      link: done ? `/projects/${projectId}?tab=boq` : `/projects/${projectId}`,
      audienceRoles: ['management', 'accounts'],
      audienceEmployeeIds: [p.managerId],
    });
  }

  /** Reads a project's progress now, for `progressMilestones` to compare against afterwards. */
  progressOf(projectId: string): Promise<number> {
    return projectProgress(this.db, projectId);
  }
}

/**
 * "Is this notification for me?" The `@>` (contains) operator can use the
 * GIN indexes on both array columns.
 */
function visibleTo(user: CurrentUser) {
  return or(
    sql`${notifications.audienceRoles} @> ARRAY[${user.role}]::text[]`,
    sql`${notifications.audienceEmployeeIds} @> ARRAY[${user.employeeId}]::uuid[]`,
  );
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
