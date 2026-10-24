import { ApiError, clone, db, simulateLatency } from "@/api/mockDb";
import { uid } from "@/lib/utils";
import type { EngineerReview } from "@/types/models";

export type ReviewInput = Pick<EngineerReview, "employeeId" | "rating" | "comments">;

export const reviewService = {
  // GET /api/engineer-reviews
  async list(): Promise<EngineerReview[]> {
    await simulateLatency();
    return clone(db.read().engineerReviews);
  },

  /**
   * PUT /api/projects/:id/reviews
   * Saves the PM's reviews for a closed project. Reviewing the same engineer
   * again on the same project updates the earlier review instead of adding one.
   */
  async saveForProject(projectId: string, reviewerId: string, reviews: ReviewInput[]): Promise<EngineerReview[]> {
    await simulateLatency();
    return db.write((data) => {
      const project = data.projects.find((p) => p.id === projectId);
      if (!project) throw new ApiError("Project not found", 404);
      if (project.status !== "completed") throw new ApiError("Engineers are reviewed once the project is completed");
      const now = new Date().toISOString();
      const saved: EngineerReview[] = [];
      for (const r of reviews) {
        if (!(r.rating >= 1 && r.rating <= 5)) throw new ApiError("Each rating must be between 1 and 5");
        const existing = data.engineerReviews.find((x) => x.projectId === projectId && x.employeeId === r.employeeId);
        if (existing) {
          Object.assign(existing, { rating: r.rating, comments: r.comments.trim(), reviewerId, updatedAt: now });
          saved.push(existing);
        } else {
          const review: EngineerReview = { id: uid("rev"), projectId, reviewerId, ...r, comments: r.comments.trim(), createdAt: now, updatedAt: now };
          data.engineerReviews.push(review);
          saved.push(review);
        }
      }
      return clone(saved);
    });
  },
};
