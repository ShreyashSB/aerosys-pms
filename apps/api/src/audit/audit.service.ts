import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gte, ilike, lt, or, sql, type SQL } from 'drizzle-orm';
import type { CurrentUser } from '../auth/current-user.js';
import { DB, type Database } from '../db/db.module.js';
import { auditLog, type AuditRow } from '../db/schema.js';
import { actionOf, diff, type AuditMeta } from './audit.js';
import { AUDIT_ENTITIES, projectLabels, type Snapshot } from './audit.entities.js';
import type { HistoryQuery } from './audit.dto.js';

export interface HistoryPage {
  entries: AuditRow[];
  /** Pass back as `before` for the next (older) page; null when there are no more. */
  nextCursor: string | null;
}

@Injectable()
export class AuditService {
  private readonly log = new Logger(AuditService.name);

  constructor(@Inject(DB) private readonly db: Database) {}

  /** The record as it is now, or null if it doesn't exist (yet, or any more). */
  async snapshot(entity: AuditMeta['entity'], id: string | undefined): Promise<Snapshot | null> {
    if (!id) return null;
    try {
      return await AUDIT_ENTITIES[entity](this.db, id);
    } catch {
      // A malformed id: the route itself answers 400.
      return null;
    }
  }

  /**
   * Saves one history row, unless nothing changed. Never throws: the change
   * itself is already saved, and a history problem must not show the person
   * an error for it. Failures are logged instead.
   */
  async record(meta: AuditMeta, actor: CurrentUser, id: string, before: Snapshot | null, after: Snapshot | null): Promise<void> {
    try {
      const current = after ?? before;
      if (!current) return;
      const changes = diff(before?.values ?? null, after?.values ?? null);
      if (changes.length === 0 && !meta.summary && before && after) return;
      const projectId = current.projectId;
      const projectLabel = meta.entity === 'project' ? current.label : projectId ? ((await projectLabels(this.db, [projectId])).get(projectId) ?? null) : null;
      await this.db.insert(auditLog).values({
        actorEmployeeId: actor.employeeId,
        actorName: actor.name,
        actorRole: actor.role,
        entity: meta.entity,
        entityId: id,
        entityLabel: current.label,
        projectId,
        projectLabel,
        action: actionOf(before, after),
        summary: meta.summary ?? null,
        changes,
      });
    } catch (err) {
      this.log.error(`Could not save the change history for ${meta.entity} ${id}`, err instanceof Error ? err.stack : String(err));
    }
  }

  /** Newest first, 50 at a time, narrowed by the filters. */
  async list(q: HistoryQuery): Promise<HistoryPage> {
    const where: (SQL | undefined)[] = [
      q.entity ? eq(auditLog.entity, q.entity) : undefined,
      q.entityId ? eq(auditLog.entityId, q.entityId) : undefined,
      q.projectId ? eq(auditLog.projectId, q.projectId) : undefined,
      q.actorId ? eq(auditLog.actorEmployeeId, q.actorId) : undefined,
      q.action ? eq(auditLog.action, q.action) : undefined,
      // Dates are the person's day in India.
      q.from ? gte(auditLog.at, sql`(${q.from}::date)::timestamp AT TIME ZONE 'Asia/Kolkata'`) : undefined,
      q.to ? lt(auditLog.at, sql`(${q.to}::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'`) : undefined,
      q.q
        ? or(
            ilike(auditLog.entityLabel, `%${q.q}%`),
            ilike(auditLog.actorName, `%${q.q}%`),
            ilike(auditLog.projectLabel, `%${q.q}%`),
            ilike(sql`${auditLog.changes}::text`, `%${q.q}%`),
          )
        : undefined,
      q.before ? cursorBefore(q.before) : undefined,
    ];
    const rows = await this.db
      .select({ row: auditLog, cursor: sql<string>`${auditLog.at}::text || '|' || ${auditLog.id}::text` })
      .from(auditLog)
      .where(and(...where))
      .orderBy(desc(auditLog.at), desc(auditLog.id))
      .limit(q.limit + 1);
    const page = rows.slice(0, q.limit);
    return { entries: page.map((r) => r.row), nextCursor: rows.length > q.limit ? page.at(-1)!.cursor : null };
  }
}

/**
 * Rows older than the cursor's (time, id). The time is Postgres's own text,
 * so no microseconds are lost; the id breaks ties between rows saved in the
 * same instant.
 */
function cursorBefore(cursor: string): SQL | undefined {
  const [at, id] = cursor.split('|');
  if (!at || !id || Number.isNaN(Date.parse(at)) || !UUID.test(id)) return undefined;
  return sql`(${auditLog.at}, ${auditLog.id}) < (${at}::timestamptz, ${id}::uuid)`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
