import { describe, expect, it } from 'vitest';
import { siteUrl } from '@/lib/site-url';

describe('siteUrl', () => {
  it('uses the configured origin without a trailing slash', () => {
    expect(siteUrl('https://campussubleases.com/')).toBe('https://campussubleases.com');
    expect(siteUrl('https://campussubleases.com')).toBe('https://campussubleases.com');
  });

  it('falls back to the local dev server when unset or blank', () => {
    expect(siteUrl(undefined)).toBe('http://localhost:3000');
    expect(siteUrl('  ')).toBe('http://localhost:3000');
  });
});
