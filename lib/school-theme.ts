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

function relativeLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// The color a school lights the ink landing with: a near-black primary would vanish, so it uses the secondary.
export function schoolGlowColor(theme: SchoolTheme): string {
  return relativeLuminance(theme.primary) < 0.05 ? theme.secondary : theme.primary;
}
