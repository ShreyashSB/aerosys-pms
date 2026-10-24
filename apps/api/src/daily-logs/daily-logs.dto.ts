import { z } from 'zod';
import { isoDate } from '../common/dates.js';

export const ATTENDANCE_STATUSES = ['on_site', 'off_site', 'idle', 'weekly_off', 'holiday', 'leave'] as const;
/** Statuses that count as a man-day: a person can be in one of these on only one project a day. */
export const WORKING_STATUSES = ['on_site', 'off_site', 'idle'] as const;
export const IDLE_REASONS = [
  'Site not ready',
  'Material unavailable',
  'Client dependency',
  'Equipment unavailable',
  'Approval pending',
  'Design issue',
  'Weather',
  'Other',
] as const;

const AttendanceSchema = z
  .object({
    employeeId: z.uuid(),
    status: z.enum(ATTENDANCE_STATUSES),
    idleHours: z.number().min(0, 'Idle hours cannot be negative').default(0),
    idleReason: z.enum(IDLE_REASONS).nullable().default(null),
  })
  .refine((a) => !(a.status === 'idle' || a.idleHours > 0) || a.idleReason, {
    path: ['idleReason'],
    message: 'Select an idle reason for every idle entry',
  });

const WorkLineSchema = z.object({
  boqItemId: z.uuid('Each work line needs a BOQ item'),
  qty: z.number().positive('Each work line needs a quantity above zero'),
  remarks: z.string().trim().max(500).default(''),
});

/** Body for POST /api/projects/:projectId/daily-logs and PUT /api/daily-logs/:id. */
export const DailyLogInputSchema = z.object({
  date: isoDate,
  attendance: z
    .array(AttendanceSchema)
    .min(1, 'Add at least one person to the attendance')
    .refine((rows) => new Set(rows.map((r) => r.employeeId)).size === rows.length, 'Each person can appear only once in a log'),
  activities: z.string().trim().max(2000).default(''),
  remarks: z.string().trim().max(2000).default(''),
  work: z.array(WorkLineSchema).default([]),
});

export type DailyLogInput = z.infer<typeof DailyLogInputSchema>;
export type AttendanceInput = DailyLogInput['attendance'][number];

/** What the API returns: the web app's `DailyLog` shape, attendance included. */
export interface DailyLogDto {
  id: string;
  projectId: string;
  date: string;
  attendance: Array<Omit<AttendanceInput, 'idleReason'> & { idleReason: string | null }>;
  activities: string;
  remarks: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}
