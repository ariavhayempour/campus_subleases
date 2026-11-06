'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';
import { NEUTRAL_THEME, schoolThemeStyle } from '@/lib/school-theme';
import { resolveThemeSchool } from '@/lib/theme-school';
import type { SchoolSummary } from '@/server/services/schools';

type SchoolThemeValue = { schools: SchoolSummary[]; homeSchoolSlug: string | null };

const SchoolThemeContext = createContext<SchoolThemeValue>({ schools: [], homeSchoolSlug: null });

export function SchoolThemeProvider({
  schools,
  homeSchoolSlug,
  children,
}: SchoolThemeValue & { children: ReactNode }) {
  return (
    <SchoolThemeContext.Provider value={{ schools, homeSchoolSlug }}>
      <ThemeSync />
      {children}
    </SchoolThemeContext.Provider>
  );
}

export function useSchoolThemeContext(): SchoolThemeValue {
  return useContext(SchoolThemeContext);
}

export function useThemeSchool(): SchoolSummary | null {
  const pathname = usePathname();
  const { schools, homeSchoolSlug } = useSchoolThemeContext();
  return resolveThemeSchool(pathname, schools, homeSchoolSlug);
}

// The root layout stays mounted across navigations, so its server-set colors need updating here.
function ThemeSync() {
  const school = useThemeSchool();
  const theme = school?.theme ?? NEUTRAL_THEME;
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    for (const [name, value] of Object.entries(schoolThemeStyle(theme))) {
      root.setProperty(name, String(value));
    }
  }, [theme]);
  return null;
}
