import { sql } from 'drizzle-orm';
import { todayIST } from '../common/dates.js';
import type { Database } from '../db/db.module.js';

/**
 * Work done as a share of the BOQ value (0–1), for each project asked for.
 * Same rule as the web's `progressFromBoq`: executed quantity × rate, over
 * contract quantity × rate, capped at 100%. Done in SQL so the database adds
 * up the rows instead of shipping them all to Node.
 */
export async function progressByProject(db: Pick<Database, 'execute'>, projectIds: string[]): Promise<Map<string, number>> {
  if (!projectIds.length) return new Map();
  const today = todayIST();
  const rows = await db.execute<{ project_id: string; total: string | null; executed: string | null }>(sql`
    SELECT i.project_id,
           SUM(i.contract_qty * i.rate) AS total,
           (SELECT SUM(x.qty * xi.rate)
              FROM boq_executions x JOIN boq_items xi ON xi.id = x.boq_item_id
             WHERE x.project_id = i.project_id AND x.date <= ${today}) AS executed
      FROM boq_items i
     WHERE i.project_id IN (${sql.join(projectIds.map((id) => sql`${id}::uuid`), sql`, `)})
     GROUP BY i.project_id`);
  const out = new Map<string, number>();
  for (const r of rows) {
    const total = Number(r.total ?? 0);
    const executed = Number(r.executed ?? 0);
    out.set(r.project_id, total > 0 ? Math.min(1, executed / total) : 0);
  }
  return out;
}

export async function projectProgress(db: Pick<Database, 'execute'>, projectId: string): Promise<number> {
  return (await progressByProject(db, [projectId])).get(projectId) ?? 0;
}
