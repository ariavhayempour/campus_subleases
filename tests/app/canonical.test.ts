import { describe, expect, it, vi } from 'vitest';
import { siteUrl } from '@/lib/site-url';
import { createSchool } from '../helpers/fixtures';
import { withRollback } from '../helpers/db';

// Page modules import Clerk, next/font, and components that only run inside Next.
vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: 'geist-sans' }),
  Geist_Mono: () => ({ variable: 'geist-mono' }),
}));
vi.mock('@clerk/nextjs', () => ({ ClerkProvider: () => null }));
vi.mock('@clerk/ui/themes', () => ({ shadcn: {} }));
vi.mock('@/app/_components/messaging-provider', () => ({ MessagingProvider: () => null }));
vi.mock('@/app/_components/site-header', () => ({ SiteHeader: () => null }));
vi.mock('@/app/_components/site-footer', () => ({ SiteFooter: () => null }));
vi.mock('@/server/auth/get-actor', () => ({ getActor: vi.fn() }));
vi.mock('@/app/[school]/_components/browse-filters', () => ({ BrowseFilters: () => null }));
vi.mock('@/app/[school]/_components/browse-view', () => ({ BrowseView: () => null }));
vi.mock('@/app/contact/contact-form', () => ({ ContactForm: () => null }));

describe('canonical URLs', () => {
  it('sets metadataBase from the site URL in the root layout', async () => {
    const { metadata } = await import('@/app/layout');
    expect(metadata.metadataBase?.toString()).toBe(`${siteUrl()}/`);
  });

  it('canonicalizes the home page to /', async () => {
    const { metadata } = await import('@/app/page');
    expect(metadata.alternates?.canonical).toBe('/');
  });

  it.each([
    ['/about', () => import('@/app/about/page')],
    ['/terms', () => import('@/app/terms/page')],
    ['/privacy', () => import('@/app/privacy/page')],
    ['/contact', () => import('@/app/contact/page')],
  ])('canonicalizes %s to itself', async (path, load) => {
    const { metadata } = await load();
    expect(metadata.alternates?.canonical).toBe(path);
  });

  it('drops the query string from a school page canonical', async () => {
    await withRollback(async () => {
      const school = await createSchool();
      const { generateMetadata } = await import('@/app/[school]/page');
      const metadata = await generateMetadata({
        params: Promise.resolve({ school: school.slug }),
        searchParams: Promise.resolve({ q: 'loft', bbox: '-89.5,43,-89.3,43.2' }),
      });
      expect(metadata.alternates?.canonical).toBe(`/${school.slug}`);
    });
  });
});
