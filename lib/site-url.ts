const LOCAL_SITE_URL = 'http://localhost:3000';

// Origin for absolute URLs (robots.txt, sitemap); no trailing slash.
export function siteUrl(value: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  return (value?.trim() || LOCAL_SITE_URL).replace(/\/+$/, '');
}
