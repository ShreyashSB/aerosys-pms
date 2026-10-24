import { z } from 'zod';

/** What the API accepts when someone picks "Add new" in the client dropdown. */
export const CreateClientSchema = z.object({
  name: z.string().trim().min(2, 'Client name must be at least 2 characters').max(120),
});

export type CreateClientDto = z.infer<typeof CreateClientSchema>;
