import { SetMetadata } from '@nestjs/common';
import type { AuditChange } from '../db/schema.js';
import type { AuditEntity, Snapshot } from './audit.entities.js';

export interface AuditMeta {
  entity: AuditEntity;
  /** Route parameter holding the record's id. Left out on create routes: the id then comes from the response. */
  param?: string;
  /** For a record that has no id in the route, such as the one settings row. */
  fixedId?: string;
  /** Words for the change when the fields don't say it, e.g. "Reset the password". Saved even if no field changed. */
  summary?: string;
}

export const AUDIT = 'audit';
/**
 * `@Audit('employee', { param: 'id' })` on a write route: AuditInterceptor
 * snapshots the record before and after the route runs and saves what
 * changed, who changed it and when to the change history.
 */
export const Audit = (entity: AuditEntity, opts: Omit<AuditMeta, 'entity'> = {}) => SetMetadata(AUDIT, { entity, ...opts } satisfies AuditMeta);

/** create when there was nothing before, delete when nothing is left, update otherwise. */
export function actionOf(before: Snapshot | null, after: Snapshot | null): 'create' | 'update' | 'delete' {
  if (!before) return 'create';
  if (!after) return 'delete';
  return 'update';
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const blank = (v: unknown) => v === null || v === undefined || v === '';

/**
 * The fields whose value differs between two snapshots, in the order they
 * first appear. On a create or delete, empty fields are left out.
 */
export function diff(before: Record<string, unknown> | null, after: Record<string, unknown> | null): AuditChange[] {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  const changes: AuditChange[] = [];
  for (const field of keys) {
    const from = before?.[field] ?? null;
    const to = after?.[field] ?? null;
    if (same(from, to)) continue;
    if ((!before || !after) && blank(from) && blank(to)) continue;
    changes.push({ field, from, to });
  }
  return changes;
}
