import { ApiError, clone, db, simulateLatency } from "@/api/mockDb";
import { todayISO } from "@/lib/dates";
import { uid } from "@/lib/utils";
import type { BoqExecution, BoqItem } from "@/types/models";
import { notifyProgressMilestones, projectProgress } from "./progressEvents";

export type BoqItemInput = Pick<BoqItem, "projectId" | "srNo" | "description" | "uom" | "contractQty" | "rate">;
export type ExecutionInput = Pick<BoqExecution, "projectId" | "boqItemId" | "date" | "qty" | "remarks">;

function validateItem(i: BoqItemInput) {
  if (!i.description.trim()) throw new ApiError("Item description is required");
  if (!i.uom.trim()) throw new ApiError("UOM is required");
  if (!(i.contractQty > 0)) throw new ApiError("Contract quantity must be greater than zero");
  if (!(i.rate >= 0)) throw new ApiError("Rate cannot be negative");
}

export const boqService = {
  // GET /api/boq-items
  async listItems(): Promise<BoqItem[]> {
    await simulateLatency();
    return clone(db.read().boqItems);
  },
  // GET /api/boq-executions
  async listExecutions(): Promise<BoqExecution[]> {
    await simulateLatency();
    return clone(db.read().boqExecutions);
  },

  // POST /api/projects/:id/boq-items
  async createItem(input: BoqItemInput): Promise<BoqItem> {
    await simulateLatency();
    validateItem(input);
    return db.write((data) => {
      const before = projectProgress(data, input.projectId);
      const item: BoqItem = { ...input, id: uid("boq") };
      data.boqItems.push(item);
      notifyProgressMilestones(data, input.projectId, before);
      return clone(item);
    });
  },

  // PUT /api/boq-items/:id
  async updateItem(id: string, input: BoqItemInput): Promise<BoqItem> {
    await simulateLatency();
    validateItem(input);
    return db.write((data) => {
      const item = data.boqItems.find((b) => b.id === id);
      if (!item) throw new ApiError("BOQ item not found", 404);
      const before = projectProgress(data, item.projectId);
      Object.assign(item, input);
      notifyProgressMilestones(data, item.projectId, before);
      return clone(item);
    });
  },

  // DELETE /api/boq-items/:id – also removes its execution history
  async deleteItem(id: string): Promise<void> {
    await simulateLatency();
    db.write((data) => {
      data.boqItems = data.boqItems.filter((b) => b.id !== id);
      data.boqExecutions = data.boqExecutions.filter((x) => x.boqItemId !== id);
    });
  },

  // POST /api/boq-items/:id/executions – manual measurement update
  async addExecution(input: ExecutionInput): Promise<BoqExecution> {
    await simulateLatency();
    if (!input.qty) throw new ApiError("Enter a non-zero quantity");
    if (input.date > todayISO()) throw new ApiError("Execution date cannot be in the future");
    return db.write((data) => {
      const item = data.boqItems.find((b) => b.id === input.boqItemId);
      if (!item) throw new ApiError("BOQ item not found", 404);
      const executed = data.boqExecutions.filter((x) => x.boqItemId === item.id).reduce((s, x) => s + x.qty, 0);
      if (executed + input.qty < 0) throw new ApiError("Correction would make executed quantity negative");
      const before = projectProgress(data, input.projectId);
      const exe: BoqExecution = { ...input, id: uid("exe"), dailyLogId: null };
      data.boqExecutions.push(exe);
      notifyProgressMilestones(data, input.projectId, before);
      return clone(exe);
    });
  },

  // DELETE /api/boq-executions/:id (manual entries only; daily-log entries are edited via the log)
  async deleteExecution(id: string): Promise<void> {
    await simulateLatency();
    db.write((data) => {
      const x = data.boqExecutions.find((e) => e.id === id);
      if (!x) throw new ApiError("Entry not found", 404);
      if (x.dailyLogId) throw new ApiError("This quantity came from a daily log – edit the log instead");
      data.boqExecutions = data.boqExecutions.filter((e) => e.id !== id);
    });
  },

  /** Close the measurement (RA bill) period: Current quantities roll into Previous. */
  async closePeriod(projectId: string): Promise<void> {
    await simulateLatency();
    db.write((data) => {
      const p = data.projects.find((x) => x.id === projectId);
      if (!p) throw new ApiError("Project not found", 404);
      p.periodStart = todayISO();
    });
  },
};
