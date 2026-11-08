import { db, simulateLatency } from "@/api/mockDb";
import { loadEntries } from "@/api/demoHistory";
import type { AuditEntry, HistoryPage, HistoryQuery } from "@/types/models";
import { includesText } from "@/lib/utils";

/** Demo data: the history kept in this browser (see api/demoHistory.ts). Same filters as GET /api/history. */
export const historyService = {
  async list(q: HistoryQuery = {}): Promise<HistoryPage> {
    await simulateLatency(80, 200);
    const limit = q.limit ?? 50;
    let rows: AuditEntry[] = loadEntries(db.read()).filter(
      (e) =>
        (!q.entity || e.entity === q.entity) &&
        (!q.entityId || e.entityId === q.entityId) &&
        (!q.projectId || e.projectId === q.projectId) &&
        (!q.actorId || e.actorEmployeeId === q.actorId) &&
        (!q.action || e.action === q.action) &&
        (!q.from || dayOf(e.at) >= q.from) &&
        (!q.to || dayOf(e.at) <= q.to) &&
        (!q.q || includesText([e.entityLabel, e.actorName, e.projectLabel, JSON.stringify(e.changes)], q.q)),
    );
    if (q.before) {
      const i = rows.findIndex((e) => e.id === q.before);
      rows = i >= 0 ? rows.slice(i + 1) : rows;
    }
    const entries = rows.slice(0, limit);
    return { entries, nextCursor: rows.length > limit ? entries[entries.length - 1].id : null };
  },
};

/** The day in India, like the server's from/to filters. */
function dayOf(iso: string) {
  return new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}
