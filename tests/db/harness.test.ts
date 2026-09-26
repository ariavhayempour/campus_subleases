import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, rootDb } from '@/server/db/client';
import { schools } from '@/server/db/schema';
import { createSchool } from '../helpers/fixtures';
import { withRollback } from '../helpers/db';

describe('database harness', () => {
  it('round-trips geography points', () =>
    withRollback(async () => {
      const school = await createSchool({ campusLocation: { lng: -83.7382, lat: 42.277 } });
      const [row] = await db().select().from(schools).where(eq(schools.id, school.id));
      expect(row.campusLocation.lng).toBeCloseTo(-83.7382, 6);
      expect(row.campusLocation.lat).toBeCloseTo(42.277, 6);
    }));

  it('rolls back everything written inside withRollback', async () => {
    let slug = '';
    await withRollback(async () => {
      slug = (await createSchool()).slug;
    });
    const rows = await rootDb().select().from(schools).where(eq(schools.slug, slug));
    expect(rows).toHaveLength(0);
  });

  it('enables RLS with no policies on every public table', async () => {
    const withoutRls = await rootDb().execute<{ relname: string }>(sql`
      select c.relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(withoutRls.map((row) => row.relname)).toEqual([]);

    const policies = await rootDb().execute<{ count: number }>(
      sql`select count(*)::int as count from pg_policies where schemaname = 'public'`,
    );
    expect(policies[0].count).toBe(0);
  });

  it('connects with a role that bypasses RLS', async () => {
    const [role] = await rootDb().execute<{ bypass: boolean }>(
      sql`select (rolsuper or rolbypassrls) as bypass from pg_roles where rolname = current_user`,
    );
    expect(role.bypass).toBe(true);
  });
});
