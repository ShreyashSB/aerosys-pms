import { z } from 'zod';
import { isoDate } from '../common/dates.js';

/** Body for POST /api/projects/:projectId/boq-items and PUT /api/boq-items/:id. */
export const BoqItemInputSchema = z.object({
  srNo: z.string().trim().min(1, 'Sr. no. is required').max(20),
  description: z.string().trim().min(1, 'Item description is required').max(1000),
  uom: z.string().trim().min(1, 'UOM is required').max(20),
  contractQty: z.number().positive('Contract quantity must be greater than zero'),
  rate: z.number().nonnegative('Rate cannot be negative'),
});
export type BoqItemInput = z.infer<typeof BoqItemInputSchema>;

/** Body for POST /api/boq-items/:id/executions: a manual measurement or correction. */
export const ExecutionInputSchema = z.object({
  date: isoDate,
  qty: z.number().refine((n) => n !== 0, 'Enter a non-zero quantity'),
  remarks: z.string().trim().max(500).default(''),
});
export type ExecutionInput = z.infer<typeof ExecutionInputSchema>;
