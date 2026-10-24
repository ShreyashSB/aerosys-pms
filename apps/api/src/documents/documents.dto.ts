import { z } from 'zod';

export const DOCUMENT_TYPES = ['Work Order', 'Annexure / BOQ', 'Drawing', 'Measurement Sheet', 'Correspondence', 'Other'] as const;

/** Body for POST /api/projects/:projectId/documents. The file bytes come later, with object storage. */
export const DocumentInputSchema = z.object({
  name: z.string().trim().min(1, 'File name is required').max(255),
  type: z.enum(DOCUMENT_TYPES),
  size: z.number().int().nonnegative().max(25 * 1024 * 1024, 'Files must be smaller than 25 MB'),
  mimeType: z.string().trim().min(1).max(100),
});
export type DocumentInput = z.infer<typeof DocumentInputSchema>;
