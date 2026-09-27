import { describe, expect, it } from 'vitest';
import { formatDisplayName } from '@/lib/display-name';

describe('formatDisplayName', () => {
  it('uses the first name and last initial', () => {
    expect(formatDisplayName('Ada', 'Lovelace')).toBe('Ada L.');
  });

  it('trims whitespace and capitalizes the initial', () => {
    expect(formatDisplayName('  Grace ', ' hopper')).toBe('Grace H.');
  });

  it('falls back to the first name when the last name is missing', () => {
    expect(formatDisplayName('Cher', '')).toBe('Cher');
    expect(formatDisplayName('Cher', null)).toBe('Cher');
  });

  it('falls back to the last initial when the first name is missing', () => {
    expect(formatDisplayName(null, 'Turing')).toBe('T.');
  });

  it('returns a placeholder when both are missing', () => {
    expect(formatDisplayName(' ', null)).toBe('Student');
  });
});
