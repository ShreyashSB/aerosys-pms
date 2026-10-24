import { z } from 'zod';

const MAX_BYTES = 10 * 1024 * 1024;

/** Details of an attached file (receipt, bill copy). The file itself is uploaded separately later. */
export const AttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative().max(MAX_BYTES, 'Attachment must be smaller than 10 MB'),
  mimeType: z.string().trim().min(1).max(100),
});
