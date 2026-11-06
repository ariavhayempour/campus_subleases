import { describe, expect, it } from 'vitest';
import { termTimeline, todayIso } from '@/lib/term-timeline';

describe('termTimeline', () => {
  it('starts the axis at the four-month block containing move-in by default', () => {
    const t = termTimeline('2027-05-20', '2027-08-14');
    expect(t.months[0]).toBe('May');
    expect(t.blocks.map((b) => b.label)).toEqual(['May–Aug ’27', 'Sep–Dec ’27', 'Jan–Apr ’28']);
    expect(t.blocks.map((b) => b.active)).toEqual([true, false, false]);
  });

  it('puts every stay on the same blocks when given a shared axis start', () => {
    const summer = termTimeline('2027-05-20', '2027-08-14', '2026-11-05');
    const spring = termTimeline('2027-01-10', '2027-05-20', '2026-11-05');
    expect(summer.blocks.map((b) => b.label)).toEqual(spring.blocks.map((b) => b.label));
    expect(summer.blocks.map((b) => b.label)).toEqual([
      'Sep–Dec ’26',
      'Jan–Apr ’27',
      'May–Aug ’27',
    ]);
    expect(spring.leftPct).toBeLessThan(summer.leftPct);
  });

  it('sizes the bar to the stay', () => {
    const t = termTimeline('2027-01-01', '2027-04-30');
    expect(t.leftPct).toBe(0);
    expect(t.widthPct).toBeCloseTo(32.9, 0);
    expect(t.continues).toBe(false);
  });

  it('clips stays that started before or run past the axis', () => {
    const ongoing = termTimeline('2026-08-01', '2027-02-01', '2026-11-05');
    expect(ongoing).toMatchObject({ leftPct: 0, startsBefore: true, continues: false });
    const long = termTimeline('2027-03-15', '2028-06-01');
    expect(long.blocks.every((b) => b.active)).toBe(true);
    expect(long.leftPct + long.widthPct).toBeCloseTo(100, 5);
    expect(long.continues).toBe(true);
  });

  it('keeps a stay that starts after the axis visible at its end', () => {
    const later = termTimeline('2027-10-01', '2027-12-15', '2026-11-05');
    expect(later.leftPct + later.widthPct).toBeLessThanOrEqual(100);
    expect(later.widthPct).toBeGreaterThan(0);
    expect(later.continues).toBe(true);
  });

  it('keeps a very short stay visible', () => {
    expect(termTimeline('2027-06-01', '2027-06-02').widthPct).toBeGreaterThanOrEqual(1.5);
  });

  it('formats today as an ISO date', () => {
    expect(todayIso(new Date('2026-11-05T23:00:00Z'))).toBe('2026-11-05');
  });
});
