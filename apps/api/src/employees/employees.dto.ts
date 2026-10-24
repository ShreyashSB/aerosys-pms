import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const DEPARTMENTS = ['Management', 'Projects', 'Engineering', 'Accounts', 'Admin', 'Service'] as const;
export const EMPLOYEE_STATUSES = ['active', 'on_leave', 'inactive'] as const;

/** Body for POST /api/employees and PUT /api/employees/:id. Mirrors the web form. */
export const EmployeeInputSchema = z.object({
  /** Leave out to get the next EMP-NNN. */
  code: z.string().trim().min(1).max(20).optional(),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: z.email('Enter a valid email').trim().toLowerCase(),
  phone: z.string().trim().max(20).default(''),
  department: z.enum(DEPARTMENTS),
  designation: z.string().trim().min(2).max(80),
  dailyCost: z.number().nonnegative('Daily cost cannot be negative'),
  joiningDate: isoDate,
  status: z.enum(EMPLOYEE_STATUSES).default('active'),
  isSiteEngineer: z.boolean().default(false),
  baseLocation: z.string().trim().max(80).default(''),
});

export type EmployeeInput = z.infer<typeof EmployeeInputSchema>;
