import { afterEach, describe, expect, it, vi } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

const ORIGIN = 'https://studentsubleases.com';

afterEach(() => {
  vi.unstubAllEnvs();
});

function disallowPatterns(): string[] {
  const { rules } = robots();
  return [(Array.isArray(rules) ? rules[0] : rules)?.disallow ?? []].flat();
}

// Robots Exclusion Protocol matching: prefix by default, `$` anchors the end.
function matches(pattern: string, path: string): boolean {
  return pattern.endsWith('$') ? path === pattern.slice(0, -1) : path.startsWith(pattern);
}

describe('robots', () => {
  it('disallows signed-in and admin routes and points at the sitemap', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', ORIGIN);
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules?.allow).toBe('/');
    expect(rules?.disallow).toEqual(
      expect.arrayContaining([
        '/admin$',
        '/admin/',
        '/messages$',
        '/messages/',
        '/settings$',
        '/onboarding$',
        '/api/',
        '/listings/',
        '/me/',
      ]),
    );
    expect(result.sitemap).toBe(`${ORIGIN}/sitemap.xml`);
  });

  it('blocks private paths but not public pages or school slugs that share a prefix', () => {
    const blocked = (path: string): boolean => disallowPatterns().some((p) => matches(p, path));
    for (const path of [
      '/admin',
      '/admin/listings',
      '/messages',
      '/messages/abc',
      '/me/favorites',
    ]) {
      expect(blocked(path), path).toBe(true);
    }
    for (const path of [
      '/',
      '/umich',
      '/umich/listings/0b9f',
      '/about',
      '/administration-college',
      '/messages-university',
    ]) {
      expect(blocked(path), path).toBe(false);
    }
  });
});

describe('sitemap', () => {
  it('lists home, every active school, and the static pages, but no listings', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', ORIGIN);
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls[0]).toBe(`${ORIGIN}/`);
    expect(urls).toEqual(
      expect.arrayContaining([
        `${ORIGIN}/uw-madison`,
        `${ORIGIN}/umich`,
        `${ORIGIN}/ucla`,
        `${ORIGIN}/about`,
        `${ORIGIN}/terms`,
        `${ORIGIN}/privacy`,
        `${ORIGIN}/contact`,
      ]),
    );
    expect(urls.some((url) => url.includes('/listings'))).toBe(false);
  });
});
