import { z } from 'zod';
import { AttachmentSchema } from '../common/attachment.js';
import { isoDate } from '../common/dates.js';

export const INSTRUMENT_CATEGORIES = ['Measurement', 'Refrigerant Handling', 'Air Balancing', 'Electrical Testing', 'Power Tools', 'Safety'] as const;
/** Statuses that can be set directly. "assigned" comes from issuing the instrument. */
export const SETTABLE_STATUSES = ['available', 'maintenance', 'retired'] as const;

/** Body for POST /api/instruments and PUT /api/instruments/:id. */
export const InstrumentInputSchema = z
  .object({
    code: z.string().trim().min(1).max(20).optional(),
    name: z.string().trim().min(1, 'Instrument name is required').max(200),
    serialNumber: z.string().trim().min(1, 'Serial number is required').max(100),
    category: z.enum(INSTRUMENT_CATEGORIES),
    assetValue: z.number().positive('Asset value must be more than zero'),
    purchaseDate: isoDate,
    endOfLifeDate: isoDate,
    currentLocation: z.string().trim().max(200).default(''),
    calibration: AttachmentSchema.extend({ validUntil: isoDate.nullable().default(null) })
      .nullable()
      .default(null),
    notes: z.string().trim().max(1000).default(''),
  })
  .refine((v) => v.endOfLifeDate > v.purchaseDate, { path: ['endOfLifeDate'], message: 'End-of-life date must be after the purchase date' });
export type InstrumentInput = z.infer<typeof InstrumentInputSchema>;

/** Body for POST /api/instruments/:id/assign. */
export const IssueInputSchema = z.object({ engineerId: z.uuid(), projectId: z.uuid() });
export type IssueInput = z.infer<typeof IssueInputSchema>;

/** Body for PATCH /api/instruments/:id/status. */
export const StatusInputSchema = z.object({ status: z.enum(SETTABLE_STATUSES), notes: z.string().trim().max(1000).optional() });
export type StatusInput = z.infer<typeof StatusInputSchema>;

export const DeploymentQuerySchema = z.object({ projectId: z.uuid().optional(), instrumentId: z.uuid().optional() });
export type DeploymentQuery = z.infer<typeof DeploymentQuerySchema>;

/** The instrument as the web app sees it: status and current holder worked out from the open deployment. */
export interface InstrumentDto {
  id: string;
  code: string;
  name: string;
  serialNumber: string;
  category: string;
  assetValue: number;
  purchaseDate: string;
  endOfLifeDate: string;
  currentLocation: string;
  calibration: { fileName: string; size: number; mimeType: string; validUntil: string | null } | null;
  status: string;
  assignedEngineerId: string | null;
  assignedProjectId: string | null;
  notes: string;
}
