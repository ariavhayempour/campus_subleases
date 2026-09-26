import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isReservedSlug, RESERVED_TOP_LEVEL_SLUGS } from '@/lib/reserved-slugs';

describe('reserved slugs', () => {
  it('rejects every top-level route name listed in the spec', () => {
    for (const slug of [
      'admin',
      'api',
      'listings',
      'me',
      'messages',
      'settings',
      'onboarding',
      'sign-in',
      'sign-up',
      'about',
      'terms',
      'privacy',
      'contact',
    ]) {
      expect(isReservedSlug(slug)).toBe(true);
    }
  });

  it('is case-insensitive', () => {
    expect(isReservedSlug('Admin')).toBe(true);
  });

  it('allows school slugs', () => {
    expect(isReservedSlug('uw-madison')).toBe(false);
  });

  it('covers every static top-level segment in app/', () => {
    const appDir = path.resolve(import.meta.dirname, '../../app');
    const staticSegments = readdirSync(appDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !/^[[(_]/.test(name));
    for (const segment of staticSegments) {
      expect(RESERVED_TOP_LEVEL_SLUGS).toContain(segment);
    }
  });
});
