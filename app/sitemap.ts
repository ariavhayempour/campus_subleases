import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';
import { listActiveSchools } from '@/server/services/schools';

// Rendered per request so the build never needs the database.
export const dynamic = 'force-dynamic';

const STATIC_PATHS = ['/about', '/terms', '/privacy', '/contact'] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteUrl();
  const schools = await listActiveSchools();
  return [
    { url: `${origin}/`, changeFrequency: 'weekly', priority: 1 },
    ...schools.map((school) => ({
      url: `${origin}/${school.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...STATIC_PATHS.map((path) => ({
      url: `${origin}${path}`,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
  ];
}
