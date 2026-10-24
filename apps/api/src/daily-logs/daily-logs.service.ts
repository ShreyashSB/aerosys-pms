import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import { todayIST } from '../common/dates.js';
import { isUniqueViolation } from '../common/pg-errors.js';
import { DB, type Database } from '../db/db.module.js';
import { attendanceEntries, boqExecutions, boqItems, dailyLogs, employees, projects, settings, type DailyLogRow } from '../db/schema.js';
import { findProject, isClosed } from '../projects/find-project.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { formatNumber } from '../common/format.js';
import { WORKING_STATUSES, type DailyLogDto, type DailyLogInput } from './daily-logs.dto.js';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

@Injectable()
export class DailyLogsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly notifications: NotificationsService,
  ) {}

  /** Logs with their attendance: two queries, then grouped in memory (no N+1 queries). */
  async list(projectId?: string): Promise<DailyLogDto[]> {
    const logs = await this.db
      .select()
      .from(dailyLogs)
      .where(projectId ? eq(dailyLogs.projectId, projectId) : undefined)
      .orderBy(asc(dailyLogs.date));
    return this.withAttendance(logs);
  }

  async get(id: string): Promise<DailyLogDto> {
    const [log] = await this.db.select().from(dailyLogs).where(eq(dailyLogs.id, id));
    if (!log) throw new NotFoundException('Daily log not found');
    return (await this.withAttendance([log]))[0];
  }

  /** `actorId`: the signed-in employee, recorded as the log's author. */
  create(projectId: string, input: DailyLogInput, actorId: string): Promise<DailyLogDto> {
    return this.save(projectId, input, actorId);
  }

  async update(id: string, input: DailyLogInput): Promise<DailyLogDto> {
    const [log] = await this.db.select().from(dailyLogs).where(eq(dailyLogs.id, id));
    if (!log) throw new NotFoundException('Daily log not found');
    return this.save(log.projectId, input, log.createdById, id);
  }

  /** Deleting a log also deletes its attendance and the BOQ quantities it recorded (ON DELETE CASCADE). */
  async remove(id: string): Promise<void> {
    const [row] = await this.db.delete(dailyLogs).where(eq(dailyLogs.id, id)).returning({ id: dailyLogs.id });
    if (!row) throw new NotFoundException('Daily log not found');
  }

  /**
   * Saves the log, its attendance and its work lines in one transaction. On
   * edit, the old attendance and work rows are replaced with the new ones.
   */
  private async save(projectId: string, input: DailyLogInput, actorId: string, logId?: string): Promise<DailyLogDto> {
    const project = await findProject(this.db, projectId);
    if (isClosed(project)) throw new BadRequestException('Project is closed for daily logging');
    if (input.date > todayIST()) throw new BadRequestException('Daily logs cannot be created for future dates');
    if (input.date < project.startDate) throw new BadRequestException('Date is before the project start date');
    const hoursPerManDay = await this.checkIdleHours(input);
    await this.checkPeople(input);
    await this.checkDoubleBooking(input, logId);
    await this.checkWorkItems(projectId, input);

    const attendance = input.attendance.map((a) => ({
      ...a,
      // A fully idle day has no partial idle hours; an off day has neither.
      idleHours: a.status === 'idle' || !(WORKING_STATUSES as readonly string[]).includes(a.status) ? 0 : a.idleHours,
      idleReason: a.status === 'idle' || a.idleHours > 0 ? a.idleReason : null,
    }));

    const progressBefore = await this.notifications.progressOf(projectId);
    let id: string;
    try {
      id = await this.db.transaction(async (tx) => {
        const fields = { date: input.date, activities: input.activities, remarks: input.remarks };
        let id = logId;
        if (id) {
          await tx.update(dailyLogs).set(fields).where(eq(dailyLogs.id, id));
          await tx.delete(attendanceEntries).where(eq(attendanceEntries.dailyLogId, id));
          await tx.delete(boqExecutions).where(eq(boqExecutions.dailyLogId, id));
        } else {
          const [row] = await tx
            .insert(dailyLogs)
            .values({ ...fields, projectId, createdById: actorId })
            .returning({ id: dailyLogs.id });
          id = row.id;
        }
        await tx.insert(attendanceEntries).values(attendance.map((a) => ({ ...a, dailyLogId: id! })));
        if (input.work.length) {
          await tx.insert(boqExecutions).values(
            input.work.map((w) => ({ ...w, projectId, date: input.date, dailyLogId: id! })),
          );
        }
        await this.touchProject(tx, projectId);
        return id;
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('A daily log already exists for this date – open it to edit');
      throw err;
    }
    await this.notifyIdle(project, id, input.date, attendance, hoursPerManDay);
    await this.notifications.progressMilestones(projectId, progressBefore);
    return this.get(id);
  }

  /** Two or more idle man-days on one log is worth the manager's attention. */
  private async notifyIdle(
    project: { id: string; name: string; managerId: string },
    logId: string,
    date: string,
    attendance: Array<{ status: string; idleHours: number; idleReason: string | null }>,
    hoursPerManDay: number,
  ) {
    const idle = attendance.reduce((s, a) => s + idleManDays(a.status, a.idleHours, hoursPerManDay), 0);
    if (idle < 2) return;
    const reasons = [...new Set(attendance.map((a) => a.idleReason).filter(Boolean))].join(', ');
    await this.notifications.notify({
      type: 'idle_recorded',
      title: 'Idle time recorded',
      message: `${formatNumber(idle, 1)} idle man-days logged on ${project.name} for ${date} (${reasons}).`,
      link: `/projects/${project.id}?tab=log`,
      audienceRoles: ['management'],
      audienceEmployeeIds: [project.managerId],
      // Saving the same log again with the same idle time doesn't raise it twice.
      dedupeKey: `idle:${logId}:${idle}`,
    });
  }

  private async withAttendance(logs: DailyLogRow[]): Promise<DailyLogDto[]> {
    if (!logs.length) return [];
    const rows = await this.db
      .select()
      .from(attendanceEntries)
      .where(inArray(attendanceEntries.dailyLogId, logs.map((l) => l.id)));
    const byLog = new Map<string, DailyLogDto['attendance']>();
    for (const r of rows) {
      const list = byLog.get(r.dailyLogId) ?? [];
      list.push({ employeeId: r.employeeId, status: r.status as DailyLogDto['attendance'][number]['status'], idleHours: r.idleHours, idleReason: r.idleReason });
      byLog.set(r.dailyLogId, list);
    }
    return logs.map((l) => ({ ...l, attendance: byLog.get(l.id) ?? [] }));
  }

  private async checkIdleHours(input: DailyLogInput) {
    const [s] = await this.db.select({ hours: settings.hoursPerManDay }).from(settings);
    const hours = s?.hours ?? 8;
    if (input.attendance.some((a) => a.idleHours > hours)) throw new BadRequestException(`Idle hours cannot exceed ${hours} (one man-day)`);
    return hours;
  }

  private async checkPeople(input: DailyLogInput) {
    const ids = [...new Set(input.attendance.map((a) => a.employeeId))];
    const found = await this.db.select({ id: employees.id }).from(employees).where(inArray(employees.id, ids));
    if (found.length !== ids.length) throw new BadRequestException('Unknown employee in the log');
  }

  /** Nobody can be working on two projects on the same day. */
  private async checkDoubleBooking(input: DailyLogInput, logId?: string) {
    const working = input.attendance.filter((a) => (WORKING_STATUSES as readonly string[]).includes(a.status)).map((a) => a.employeeId);
    if (!working.length) return;
    const [clash] = await this.db
      .select({ name: employees.name, project: projects.name })
      .from(attendanceEntries)
      .innerJoin(dailyLogs, eq(attendanceEntries.dailyLogId, dailyLogs.id))
      .innerJoin(employees, eq(attendanceEntries.employeeId, employees.id))
      .innerJoin(projects, eq(dailyLogs.projectId, projects.id))
      .where(
        and(
          eq(dailyLogs.date, input.date),
          inArray(attendanceEntries.employeeId, working),
          inArray(attendanceEntries.status, [...WORKING_STATUSES]),
          logId ? ne(dailyLogs.id, logId) : undefined,
        ),
      )
      .limit(1);
    if (clash) throw new ConflictException(`${clash.name} is already logged as working on ${clash.project} for this date`);
  }

  private async checkWorkItems(projectId: string, input: DailyLogInput) {
    const ids = [...new Set(input.work.map((w) => w.boqItemId))];
    if (!ids.length) return;
    const found = await this.db
      .select({ id: boqItems.id })
      .from(boqItems)
      .where(and(inArray(boqItems.id, ids), eq(boqItems.projectId, projectId)));
    if (found.length !== ids.length) throw new BadRequestException("A work line points at a BOQ item from another project");
  }

  /** Bumps the project's updated_at so lists sorted by activity show it on top. */
  private touchProject(tx: Tx, projectId: string) {
    return tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
  }
}

/** Same rule as the web's `idleManDays`: a fully idle day is one man-day, partial idle hours a share of one. */
function idleManDays(status: string, idleHours: number, hoursPerManDay: number): number {
  if (status === 'idle') return 1;
  if (!(WORKING_STATUSES as readonly string[]).includes(status) || !idleHours) return 0;
  return Math.min(1, idleHours / Math.max(1, hoursPerManDay));
}
