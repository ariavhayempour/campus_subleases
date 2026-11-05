import { describe, expect, it } from 'vitest';
import { REPORT_REASONS, REPORT_TARGET_TYPES } from '@/lib/moderation-options';
import { reportReason, reportTargetType } from '@/server/db/schema';

describe('moderation options', () => {
  it('matches the database enums', () => {
    expect([...REPORT_TARGET_TYPES]).toEqual(reportTargetType.enumValues);
    expect([...REPORT_REASONS]).toEqual(reportReason.enumValues);
  });
});
