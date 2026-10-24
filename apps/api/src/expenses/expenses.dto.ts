import { z } from 'zod';
import { AttachmentSchema } from '../common/attachment.js';
import { isoDate } from '../common/dates.js';

export const EXPENSE_CATEGORIES = ['Travel', 'Accommodation', 'Food', 'Local Conveyance', 'Site Material', 'Tools & Consumables', 'Other'] as const;

/** Body for POST /api/expenses. `employeeId` is who spent the money; Accounts records it for them. */
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

export const ExpenseQuerySchema = z.object({
  projectId: z.uuid().optional(),
});
export type ExpenseQuery = z.infer<typeof ExpenseQuerySchema>;
