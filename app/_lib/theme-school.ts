import { headers } from 'next/headers';
import { cache } from 'react';
import { PATHNAME_HEADER } from '@/lib/request-headers';
import { resolveThemeSchool } from '@/lib/theme-school';
import { getActor } from '@/server/auth/get-actor';
import { listActiveSchools, type SchoolSummary } from '@/server/services/schools';
import { getOnboardingState } from '@/server/services/users';

export type ThemeContext = {
  schools: SchoolSummary[];
  homeSchoolSlug: string | null;
  // The school the first paint wears; the client re-resolves it on navigation.
  school: SchoolSummary | null;
};

export const getThemeContext = cache(async (): Promise<ThemeContext> => {
  const [pathname, schools, actor] = await Promise.all([
    headers().then((h) => h.get(PATHNAME_HEADER) ?? '/'),
    listActiveSchools(),
    getActor(),
  ]);
  const homeSchoolSlug =
    actor.kind === 'user' ? (await getOnboardingState(actor)).homeSchoolSlug : null;
  return {
    schools,
    homeSchoolSlug,
    school: resolveThemeSchool(pathname, schools, homeSchoolSlug),
  };
});
