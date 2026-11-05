import { describe, expect, it } from 'vitest';
import { auditActorLabel, REPORT_REASONS, REPORT_TARGET_TYPES } from '@/lib/moderation-options';
import { banSchema, conversationFromSchema } from '@/lib/validation/moderation';
import { reportReason, reportTargetType } from '@/server/db/schema';

describe('moderation options', () => {
  it('matches the database enums', () => {
    expect([...REPORT_TARGET_TYPES]).toEqual(reportTargetType.enumValues);
    expect([...REPORT_REASONS]).toEqual(reportReason.enumValues);
  });
});

describe('auditActorLabel', () => {
  it('returns the admin name when present', () => {
    expect(auditActorLabel({ adminName: 'Ada Admin', action: 'approved_listing' })).toBe(
      'Ada Admin',
    );
  });

  it('labels the system auto-hide as System', () => {
    expect(auditActorLabel({ adminName: null, action: 'auto_hid_listing' })).toBe('System');
  });

  it('labels any other row without an admin as Deleted admin', () => {
    expect(auditActorLabel({ adminName: null, action: 'approved_listing' })).toBe('Deleted admin');
    expect(auditActorLabel({ adminName: null, action: 'banned_user' })).toBe('Deleted admin');
  });
});

describe('banSchema', () => {
  it('rejects a malformed user id with a readable message', () => {
    const result = banSchema.safeParse({ userId: 'bad id' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Invalid user');
  });

  it('accepts a Clerk user id', () => {
    expect(banSchema.safeParse({ userId: 'user_2abcDEF_9' }).success).toBe(true);
  });
});

describe('conversationFromSchema', () => {
  const reportId = '6f1c2b8e-3d4a-4b5c-9d6e-7f8a9b0c1d2e';

  it('parses a report origin', () => {
    expect(conversationFromSchema.parse(`report:${reportId}`)).toEqual({
      kind: 'report',
      id: reportId,
    });
  });

  it('parses a user origin', () => {
    expect(conversationFromSchema.parse('user:user_2abc')).toEqual({
      kind: 'user',
      id: 'user_2abc',
    });
  });

  it('rejects anything else', () => {
    for (const value of [
      undefined,
      ['user:user_2abc'],
      'report:not-a-uuid',
      'user:../../x',
      'listing:abc',
      '',
    ]) {
      expect(conversationFromSchema.safeParse(value).success).toBe(false);
    }
  });
});
