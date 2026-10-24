import { z } from 'zod';
import { isoDate } from '../common/dates.js';

export const PROJECT_COST_TYPES = ['subcontract', 'hire', 'other'] as const;

/** Body for POST /api/projects/:projectId/costs. */
export const ProjectCostInputSchema = z.object({
  type: z.enum(PROJECT_COST_TYPES),
  description: z.string().trim().min(1, 'Description is required').max(500),
  amount: z.number().positive('Amount must be greater than zero'),
  date: isoDate,
});
export type ProjectCostInput = z.infer<typeof ProjectCostInputSchema>;
