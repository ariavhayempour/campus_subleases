import { and, asc, eq } from 'drizzle-orm';
import { parseSchoolTheme, type SchoolTheme } from '@/lib/school-theme';
import { db } from '@/server/db/client';
import { schools } from '@/server/db/schema';
import { NotFound } from './errors';

export type School = typeof schools.$inferSelect;
export type SchoolSummary = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  city: string | null;
  campusName: string;
  theme: SchoolTheme;
};

type BrandFields = Pick<School, 'name' | 'shortName' | 'city' | 'campusName' | 'theme'>;

// Branding columns are optional so a school added as plain data still renders, in neutral colors.
export function schoolBrand(row: BrandFields): Omit<SchoolSummary, 'id' | 'slug' | 'name'> {
  return {
    shortName: row.shortName ?? row.name,
    city: row.city,
    campusName: row.campusName ?? 'campus',
    theme: parseSchoolTheme(row.theme),
  };
}

export async function listActiveSchools(): Promise<SchoolSummary[]> {
  const rows = await db()
    .select({
      id: schools.id,
      slug: schools.slug,
      name: schools.name,
      shortName: schools.shortName,
      city: schools.city,
      campusName: schools.campusName,
      theme: schools.theme,
    })
    .from(schools)
    .where(eq(schools.isActive, true))
    .orderBy(asc(schools.name));
  return rows.map((row) => ({ id: row.id, slug: row.slug, name: row.name, ...schoolBrand(row) }));
}

export async function getActiveSchoolBySlug(slug: string): Promise<School> {
  const [school] = await db()
    .select()
    .from(schools)
    .where(and(eq(schools.slug, slug), eq(schools.isActive, true)));
  if (!school) throw new NotFound('School not found');
  return school;
}
