'use client';

import { createContext, type CSSProperties, type ReactNode, useContext, useState } from 'react';
import {
  NEUTRAL_THEME,
  type SchoolTheme,
  schoolGlowColor,
  schoolThemeStyle,
} from '@/lib/school-theme';

export type AccentSchool = { slug: string; shortName: string; theme: SchoolTheme };

type AccentValue = {
  schools: AccentSchool[];
  current: AccentSchool | null;
  choose: (slug: string) => void;
};

const AccentContext = createContext<AccentValue | null>(null);

// Dresses the landing below the hero in one school's colors; the term example picks which.
export function LandingAccent({
  schools,
  children,
}: {
  schools: AccentSchool[];
  children: ReactNode;
}) {
  const [slug, setSlug] = useState<string | null>(schools[0]?.slug ?? null);
  const current = schools.find((school) => school.slug === slug) ?? null;
  const theme = current?.theme ?? NEUTRAL_THEME;
  const style = {
    ...schoolThemeStyle(theme),
    '--glow': schoolGlowColor(theme),
  } as CSSProperties;

  return (
    <AccentContext.Provider value={{ schools, current, choose: setSlug }}>
      <div style={style}>{children}</div>
    </AccentContext.Provider>
  );
}

export function useLandingAccent(): AccentValue {
  const value = useContext(AccentContext);
  if (!value) throw new Error('useLandingAccent must be used inside LandingAccent');
  return value;
}
