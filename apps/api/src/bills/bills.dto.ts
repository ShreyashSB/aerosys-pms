import { z } from 'zod';
import { AttachmentSchema } from '../common/attachment.js';
import { isoDate } from '../common/dates.js';

export const BILL_KINDS = ['vendor_bill', 'client_invoice'] as const;

/** Body for POST /api/projects/:projectId/bills and PUT /api/bills/:id. */
export const BillInputSchema = z.object({
  kind: z.enum(BILL_KINDS),
  number: z.string().trim().min(1, 'Bill / invoice number is required').max(60),
  party: z.string().trim().min(1, 'Vendor or client is required').max(200),
  amount: z.number().positive('Amount must be greater than zero'),
  date: isoDate,
  attachment: AttachmentSchema.nullable().default(null),
  notes: z.string().trim().max(1000).default(''),
});
export type BillInput = z.infer<typeof BillInputSchema>;
