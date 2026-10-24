import { z } from 'zod';
import { isoDate } from '../common/dates.js';

const money = z.number().nonnegative();

export const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/**
 * Body for POST /api/projects and PUT /api/projects/:id. Same fields as the
 * web form: client, site and type travel as names; the API turns each into a
 * row id, adding it to its list the first time it appears ("Add new").
 */
export const ProjectInputSchema = z
  .object({
    /** Leave out to get the next PRJ-YYYY-NNN. */
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9/_-]+$/, 'Use letters, numbers, - / or _ only')
      .max(40)
      .optional(),
    name: z.string().trim().min(4, 'Name must be at least 4 characters').max(160),
    clientName: z.string().trim().min(2, 'Client is required').max(120),
    site: z.string().trim().min(2, 'Site / location is required').max(120),
    projectType: z.string().trim().min(2, 'Project type is required').max(80),
    workOrderNo: z.string().trim().max(60).default(''),
    poNo: z.string().trim().max(60).default(''),
    managerId: z.uuid('Select a project manager'),
    contractValue: z.number().positive('Work order value must be greater than zero'),
    estimatedCost: money,
    allottedManDays: z.number().positive('Allotted man-days must be greater than zero'),
    allottedExpenses: money.default(0),
    operationalCostPerDay: money.default(150),
    startDate: isoDate,
    endDate: isoDate,
    description: z.string().trim().max(2000).default(''),
    status: z.enum(PROJECT_STATUSES).default('planning'),
  })
  .refine((p) => p.endDate >= p.startDate, { path: ['endDate'], message: 'Expected completion must be after the start date' });

export type ProjectInput = z.infer<typeof ProjectInputSchema>;

export const ProjectStatusSchema = z.object({ status: z.enum(PROJECT_STATUSES) });

/** What the API returns: the same shape as the web app's `Project` type. */
export interface ProjectDto {
  id: string;
  code: string;
  name: string;
  clientName: string;
  site: string;
  projectType: string;
  workOrderNo: string;
  poNo: string;
  managerId: string;
  contractValue: number;
  estimatedCost: number;
  allottedManDays: number;
  allottedExpenses: number;
  operationalCostPerDay: number;
  startDate: string;
  endDate: string;
  periodStart: string;
  description: string;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}
