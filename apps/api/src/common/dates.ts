import { z } from 'zod';

/**
 * Today's date as YYYY-MM-DD in India time. The server may run in UTC
 * (Render does), where "today" flips at 5:30 am IST, so we ask for IST explicitly.
 */
export function todayIST(now = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
