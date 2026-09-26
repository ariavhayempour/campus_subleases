// School slugs share the top-level URL space with these routes.
export const RESERVED_TOP_LEVEL_SLUGS: readonly string[] = [
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
];

export function isReservedSlug(slug: string): boolean {
  return RESERVED_TOP_LEVEL_SLUGS.includes(slug.toLowerCase());
}
