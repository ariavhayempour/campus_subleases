// A school route wears that school; admin and the school picker stay neutral; anything else wears
// the viewer's home school.
export function resolveThemeSchool<T extends { slug: string }>(
  pathname: string,
  schools: readonly T[],
  homeSchoolSlug: string | null,
): T | null {
  const segment = pathname.split('/')[1] ?? '';
  const routeSchool = schools.find((school) => school.slug === segment);
  if (routeSchool) return routeSchool;
  if (segment === 'admin' || pathname === '/') return null;
  return schools.find((school) => school.slug === homeSchoolSlug) ?? null;
}
