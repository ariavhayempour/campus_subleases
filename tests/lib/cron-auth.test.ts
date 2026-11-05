import { describe, expect, it } from 'vitest';
import { isCronAuthorized } from '@/lib/cron-auth';

describe('isCronAuthorized', () => {
  it('accepts the matching bearer secret', () => {
    expect(isCronAuthorized('Bearer s3cret', 's3cret')).toBe(true);
  });

  it('rejects a missing header', () => {
    expect(isCronAuthorized(null, 's3cret')).toBe(false);
  });

  it('rejects a wrong secret', () => {
    expect(isCronAuthorized('Bearer wrong', 's3cret')).toBe(false);
  });

  it('rejects the secret without the Bearer prefix', () => {
    expect(isCronAuthorized('s3cret', 's3cret')).toBe(false);
  });

  it('rejects an empty secret', () => {
    expect(isCronAuthorized('Bearer ', '')).toBe(false);
  });

  it('rejects any header when the secret is unset', () => {
    expect(isCronAuthorized('Bearer s3cret', undefined)).toBe(false);
    expect(isCronAuthorized('Bearer undefined', undefined)).toBe(false);
  });

  it('rejects a header of a different length', () => {
    expect(isCronAuthorized('Bearer s3cret-and-more', 's3cret')).toBe(false);
  });
});
