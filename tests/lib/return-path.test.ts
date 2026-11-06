import { describe, expect, it } from 'vitest';
import { onboardingUrl, safeReturnPath } from '@/lib/return-path';

describe('safeReturnPath', () => {
  it('keeps a relative path with its query and hash', () => {
    expect(safeReturnPath('/uw-madison?q=studio&sort=rent#list')).toBe(
      '/uw-madison?q=studio&sort=rent#list',
    );
  });

  it('reduces an absolute URL to its path, whatever the origin', () => {
    expect(safeReturnPath('http://localhost:3000/umich/listings/abc')).toBe('/umich/listings/abc');
    expect(safeReturnPath('https://evil.example/umich')).toBe('/umich');
  });

  it('rejects protocol-relative and backslash tricks', () => {
    expect(safeReturnPath('//evil.example/path')).toBeNull();
    expect(safeReturnPath('/\\evil.example')).toBeNull();
    expect(safeReturnPath('http://localhost:3000//evil.example')).toBeNull();
  });

  it('rejects auth, onboarding, api, and the home page', () => {
    for (const path of [
      '/sign-in',
      '/sign-up/verify',
      '/onboarding?next=/x',
      '/api/cron/cleanup',
      '/',
    ]) {
      expect(safeReturnPath(path), path).toBeNull();
    }
    expect(safeReturnPath('/onboarding-guide')).toBe('/onboarding-guide');
  });

  it('ignores missing, empty, repeated, and unparseable values', () => {
    expect(safeReturnPath(undefined)).toBeNull();
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath('')).toBeNull();
    expect(safeReturnPath(['/umich', '/ucla'])).toBeNull();
    expect(safeReturnPath('http://[bad')).toBeNull();
  });
});

describe('onboardingUrl', () => {
  it('carries the return path as an encoded next parameter', () => {
    expect(onboardingUrl('/umich?q=a&b=c')).toBe('/onboarding?next=%2Fumich%3Fq%3Da%26b%3Dc');
    expect(onboardingUrl(null)).toBe('/onboarding');
  });
});
