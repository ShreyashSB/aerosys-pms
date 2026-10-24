import { z } from 'zod';

/** Body for PUT /api/projects/:projectId/reviews: the PM's ratings for the project's engineers. */
export const ReviewsInputSchema = z.object({
  reviews: z
    .array(
      z.object({
        employeeId: z.uuid(),
        rating: z.number().int().min(1, 'Each rating must be between 1 and 5').max(5, 'Each rating must be between 1 and 5'),
        comments: z.string().trim().max(2000).default(''),
      }),
    )
    .min(1, 'Add at least one review')
    .refine((rs) => new Set(rs.map((r) => r.employeeId)).size === rs.length, 'Each engineer can be reviewed once'),
});
export type ReviewsInput = z.infer<typeof ReviewsInputSchema>;
