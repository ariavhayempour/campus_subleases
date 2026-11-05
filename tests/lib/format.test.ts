import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateRange,
  formatDistanceKm,
  formatDuration,
  formatMonthYear,
  formatPercent,
  formatRent,
} from '@/lib/format';

describe('format', () => {
  it('formats monthly rent in whole dollars', () => {
    expect(formatRent(95_000)).toBe('$950/mo');
    expect(formatRent(123_400)).toBe('$1,234/mo');
  });

  it('formats date-only values without shifting the day', () => {
    expect(formatDate('2027-01-01')).toBe('Jan 1, 2027');
    expect(formatDateRange('2027-01-01', '2027-05-31')).toBe('Jan 1, 2027 – May 31, 2027');
  });

  it('formats distances and join dates', () => {
    expect(formatDistanceKm(1.234)).toBe('1.2 km');
    expect(formatDistanceKm(31.6)).toBe('32 km');
    expect(formatMonthYear(new Date('2026-09-15T12:00:00Z'))).toBe('September 2026');
  });

  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(720)).toBe('12 min');
    expect(formatDuration(11_520)).toBe('3 h 12 min');
    expect(formatDuration(187_200)).toBe('2 d 4 h');
  });

  it('formats percentages', () => {
    expect(formatPercent(0, 0)).toBe('—');
    expect(formatPercent(2, 3)).toBe('67%');
    expect(formatPercent(5, 5)).toBe('100%');
  });
});
