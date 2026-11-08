import { z } from 'zod';
import { AUDIT_ENTITY_NAMES } from './audit.entities.js';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

/** Query for GET /api/history. Every filter is optional. */
export const HistoryQuerySchema = z.object({
  entity: z.enum(AUDIT_ENTITY_NAMES as [string, ...string[]]).optional(),
  entityId: z.string().max(64).optional(),
  projectId: z.uuid().optional(),
  /** The employee who made the change. */
  actorId: z.uuid().optional(),
  action: z.enum(['create', 'update', 'delete']).optional(),
  from: day.optional(),
  to: day.optional(),
  /** Text search over the record, person, project and changed values. */
  q: z.string().trim().max(100).optional(),
  /** `nextCursor` from the previous page. */
  before: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;
