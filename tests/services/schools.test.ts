import { describe, expect, it } from 'vitest';
import { rootDb } from '@/server/db/client';
import { schools } from '@/server/db/schema';
import { isReservedSlug } from '@/lib/reserved-slugs';
import { NotFound } from '@/server/services/errors';
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
});
