import { z } from 'zod';
import { AttachmentSchema } from '../common/attachment.js';
import { isoDate } from '../common/dates.js';

export const EXPENSE_CATEGORIES = ['Travel', 'Accommodation', 'Food', 'Local Conveyance', 'Site Material', 'Tools & Consumables', 'Other'] as const;
export const EXPENSE_STATUSES = ['pending', 'approved', 'rejected'] as const;

/** Body for POST /api/expenses. A new expense always starts as "pending". */
export const ExpenseInputSchema = z.object({
  projectId: z.uuid(),
  employeeId: z.uuid(),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().positive('Amount must be greater than zero'),
  date: isoDate,
  description: z.string().trim().max(1000).default(''),
  receipt: AttachmentSchema.nullable().default(null),
});
export type ExpenseInput = z.infer<typeof ExpenseInputSchema>;

/** Body for PATCH /api/expenses/:id/approve and /reject. The reviewer is the signed-in person. */
export const ReviewInputSchema = z.object({
  note: z.string().trim().max(500).default(''),
});
export type ReviewInput = z.infer<typeof ReviewInputSchema>;

export const ExpenseQuerySchema = z.object({
  projectId: z.uuid().optional(),
  status: z.enum(EXPENSE_STATUSES).optional(),
});
export type ExpenseQuery = z.infer<typeof ExpenseQuerySchema>;
