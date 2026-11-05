import { z } from 'zod';
import {
  ADMIN_NOTE_MAX,
  CONFIRM_WORD,
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  REPORT_TARGET_TYPES,
} from '@/lib/moderation-options';

export const reportInputSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.string().min(1).max(100),
  reason: z.enum(REPORT_REASONS, { error: 'Choose a reason' }),
  details: z
    .string()
    .trim()
    .max(REPORT_DETAILS_MAX, 'Keep details under 1,000 characters')
    .optional()
    .transform((value) => value || undefined),
});

export const deleteAccountSchema = z.object({
  confirm: z.literal(CONFIRM_WORD, { error: `Type ${CONFIRM_WORD} to confirm` }),
});

export const adminListingsQuerySchema = z.object({
  tab: z.enum(['pending', 'approved', 'hidden', 'rejected']).default('pending'),
  school: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
});

const listingId = z.uuid();

export const listingIdSchema = z.object({ listingId });

export const approveSchema = z.object({ listingId, version: z.string().min(1).max(40) });

export const rejectSchema = approveSchema.extend({
  note: z
    .string()
    .trim()
    .min(1, 'Give the owner a reason')
    .max(ADMIN_NOTE_MAX, 'Keep the reason under 1,000 characters'),
});

export const adminDeleteListingSchema = z.object({
  listingId,
  confirm: z.literal(CONFIRM_WORD, { error: `Type ${CONFIRM_WORD} to confirm` }),
});

export const banSchema = z.object({ userId: z.string().min(1).max(100) });

export const reportsQuerySchema = z.object({
  status: z.enum(['open', 'resolved', 'all']).default('open'),
  school: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
  reason: z
    .enum(REPORT_REASONS)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export const resolveReportSchema = z.object({
  reportId: z.uuid(),
  note: z
    .string()
    .trim()
    .min(1, 'Add a resolution note')
    .max(ADMIN_NOTE_MAX, 'Keep the note under 1,000 characters'),
});

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 366;

export const statsRangeSchema = z
  .object({
    from: z.iso.date({ error: 'Choose a date' }),
    to: z.iso.date({ error: 'Choose a date' }),
  })
  .refine((range) => range.from <= range.to, {
    path: ['to'],
    error: 'The end date must be on or after the start date',
  })
  .refine(
    (range) =>
      range.from > range.to ||
      (Date.parse(range.to) - Date.parse(range.from)) / DAY_MS + 1 <= MAX_RANGE_DAYS,
    { path: ['to'], error: 'Choose a range of a year or less' },
  );
