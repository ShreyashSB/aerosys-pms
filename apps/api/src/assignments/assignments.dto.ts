import { z } from 'zod';
import { isoDate } from '../common/dates.js';

export const ASSIGNMENT_ROLES = ['Lead Engineer', 'Site Engineer', 'Technician', 'Supervisor'] as const;

/** Body for POST /api/projects/:projectId/assignments. */
export const AssignmentInputSchema = z.object({
  employeeId: z.uuid(),
  role: z.enum(ASSIGNMENT_ROLES),
  allocation: z.number().int().min(1, 'Allocation must be between 1 and 100%').max(100, 'Allocation must be between 1 and 100%'),
  startDate: isoDate,
});

export type AssignmentInput = z.infer<typeof AssignmentInputSchema>;
