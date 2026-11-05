import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

// Exact-match plus subtree, so school slugs that merely start with these stay crawlable.
const PRIVATE_SECTIONS = ['admin', 'messages', 'onboarding', 'settings'];
const PRIVATE_PREFIXES = ['/api/', '/listings/', '/me/'];

// Listing pages stay crawlable so crawlers can read their noindex tag.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        ...PRIVATE_SECTIONS.flatMap((section) => [`/${section}$`, `/${section}/`]),
        ...PRIVATE_PREFIXES,
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
