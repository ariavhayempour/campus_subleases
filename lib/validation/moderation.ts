import { z } from 'zod';
import { REPORT_DETAILS_MAX, REPORT_REASONS, REPORT_TARGET_TYPES } from '@/lib/moderation-options';

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
