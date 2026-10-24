import { ApiError, clone, db, simulateLatency } from "@/api/mockDb";
import { uid } from "@/lib/utils";
import type { ProjectCost } from "@/types/models";

export type ProjectCostInput = Omit<ProjectCost, "id">;

export const projectCostService = {
  // GET /api/project-costs
  async list(): Promise<ProjectCost[]> {
    await simulateLatency();
    return clone(db.read().projectCosts);
  },

  async create(input: ProjectCostInput): Promise<ProjectCost> {
    await simulateLatency();
    if (!(input.amount > 0)) throw new ApiError("Amount must be greater than zero");
    if (!input.description.trim()) throw new ApiError("Description is required");
    return db.write((data) => {
      const cost: ProjectCost = { ...input, id: uid("pc") };
      data.projectCosts.push(cost);
      return clone(cost);
    });
  },

  async remove(id: string): Promise<void> {
    await simulateLatency();
    db.write((data) => {
      data.projectCosts = data.projectCosts.filter((c) => c.id !== id);
    });
  },
};
