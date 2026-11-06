import { describe, expect, it } from 'vitest';
import { NEUTRAL_THEME, schoolGlowColor, type SchoolTheme } from '@/lib/school-theme';

const theme = (primary: string, secondary: string): SchoolTheme => ({
  ...NEUTRAL_THEME,
  primary,
  secondary,
});

describe('schoolGlowColor', () => {
  it('lights with the primary when it shows on ink', () => {
    expect(schoolGlowColor(theme('#C5050C', '#FFFFFF'))).toBe('#C5050C');
    expect(schoolGlowColor(theme('#2774AE', '#FFD100'))).toBe('#2774AE');
  });

  it('falls back to the secondary for a near-black primary', () => {
    expect(schoolGlowColor(theme('#00274C', '#FFCB05'))).toBe('#FFCB05');
    expect(schoolGlowColor(NEUTRAL_THEME)).toBe('#FFFFFF');
  });
});
