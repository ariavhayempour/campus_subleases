import { describe, expect, it } from 'vitest';
import { rootDb } from '@/server/db/client';
import { schools } from '@/server/db/schema';
import { isReservedSlug } from '@/lib/reserved-slugs';
import { NotFound } from '@/server/services/errors';
import { NEUTRAL_THEME } from '@/lib/school-theme';
import { getActiveSchoolBySlug, listActiveSchools } from '@/server/services/schools';
import { withRollback } from '../helpers/db';
import { createSchool } from '../helpers/fixtures';

describe('schools service', () => {
  it('seeds the three launch schools with their timezones', async () => {
    const rows = await rootDb().select().from(schools);
    const bySlug = Object.fromEntries(rows.map((row) => [row.slug, row.timezone]));
    expect(bySlug).toMatchObject({
      'uw-madison': 'America/Chicago',
      umich: 'America/Detroit',
      ucla: 'America/Los_Angeles',
    });
  });

  it('never stores a reserved slug', async () => {
    const rows = await rootDb().select({ slug: schools.slug }).from(schools);
    for (const { slug } of rows) expect(isReservedSlug(slug)).toBe(false);
  });

  it('lists only active schools, sorted by name', () =>
    withRollback(async () => {
      await createSchool({ name: 'AAA Closed University', isActive: false });
      const list = await listActiveSchools();
      expect(list.map((school) => school.slug)).toEqual(
        expect.arrayContaining(['uw-madison', 'umich', 'ucla']),
      );
      expect(list.some((school) => school.name === 'AAA Closed University')).toBe(false);
      const names = list.map((school) => school.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    }));

  it('finds an active school by slug', async () => {
    const school = await getActiveSchoolBySlug('uw-madison');
    expect(school.name).toBe('University of Wisconsin–Madison');
    expect(school.campusLocation.lat).toBeCloseTo(43.0753, 4);
  });

  it('throws NotFound for unknown or inactive slugs', () =>
    withRollback(async () => {
      const closed = await createSchool({ isActive: false });
      await expect(getActiveSchoolBySlug('nope')).rejects.toBeInstanceOf(NotFound);
      await expect(getActiveSchoolBySlug(closed.slug)).rejects.toBeInstanceOf(NotFound);
    }));

  it('brands the launch schools with their colors and campus names', async () => {
    const bySlug = Object.fromEntries((await listActiveSchools()).map((s) => [s.slug, s]));
    expect(bySlug.umich).toMatchObject({
      shortName: 'Michigan',
      campusName: 'the Diag',
      theme: { primary: '#00274C', secondary: '#FFCB05' },
    });
    expect(bySlug['uw-madison'].theme.primary).toBe('#C5050C');
    expect(bySlug.ucla.theme.highlight).toBe('#FFD100');
  });

  it('falls back to the full name and neutral colors for an unbranded school', () =>
    withRollback(async () => {
      const plain = await createSchool({ name: 'AAA Plain University' });
      const school = (await listActiveSchools()).find((s) => s.id === plain.id);
      expect(school).toMatchObject({ shortName: 'AAA Plain University', theme: NEUTRAL_THEME });
    }));

  it('falls back to neutral colors when a stored theme is malformed', () =>
    withRollback(async () => {
      const bad = await createSchool({ theme: { primary: 'red' } as never });
      const school = (await listActiveSchools()).find((s) => s.id === bad.id);
      expect(school?.theme).toEqual(NEUTRAL_THEME);
    }));
});
