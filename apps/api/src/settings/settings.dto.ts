import { z } from 'zod';

/** Body for PUT /api/settings. Same ranges as the Settings page in the web app. */
export const SettingsInputSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required').max(160),
  deadlineAlertDays: z.number().int().min(1).max(90),
  hoursPerManDay: z.number().min(1).max(24),
  projectionMethod: z.enum(['performance', 'budget']),
  targetMarginPct: z.number().min(0).max(100),
});

export type SettingsInput = z.infer<typeof SettingsInputSchema>;
