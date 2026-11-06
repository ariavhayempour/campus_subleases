import type { CSSProperties } from 'react';
import { z } from 'zod';

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

// Each school's colors; every "on" color is the text color that passes AA on its partner.
export const schoolThemeSchema = z.object({
  primary: hex,
  primaryDeep: hex,
  onPrimary: hex,
  secondary: hex,
  onSecondary: hex,
  highlight: hex,
  onHighlight: hex,
  tint: hex,
  link: hex,
});

export type SchoolTheme = z.infer<typeof schoolThemeSchema>;

export const NEUTRAL_THEME: SchoolTheme = {
  primary: '#15171C',
  primaryDeep: '#000000',
  onPrimary: '#FFFFFF',
  secondary: '#FFFFFF',
  onSecondary: '#15171C',
  highlight: '#FFFFFF',
  onHighlight: '#15171C',
  tint: '#F1F2F4',
  link: '#15171C',
};

export function parseSchoolTheme(value: unknown): SchoolTheme {
  const parsed = schoolThemeSchema.safeParse(value);
  return parsed.success ? parsed.data : NEUTRAL_THEME;
}

export function schoolThemeStyle(theme: SchoolTheme): CSSProperties {
  return {
    '--school': theme.primary,
    '--school-deep': theme.primaryDeep,
    '--on-school': theme.onPrimary,
    '--school-secondary': theme.secondary,
    '--on-school-secondary': theme.onSecondary,
    '--school-highlight': theme.highlight,
    '--on-school-highlight': theme.onHighlight,
    '--school-tint': theme.tint,
    '--school-link': theme.link,
  } as CSSProperties;
}
