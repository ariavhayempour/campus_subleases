import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { schools } from '@/server/db/schema';
import { NotFound } from './errors';

export type School = typeof schools.$inferSelect;
export type SchoolSummary = { id: string; slug: string; name: string };

export async function listActiveSchools(): Promise<SchoolSummary[]> {
  return db()
    .select({ id: schools.id, slug: schools.slug, name: schools.name })
    .from(schools)
    .where(eq(schools.isActive, true))
    .orderBy(asc(schools.name));
}

export async function getActiveSchoolBySlug(slug: string): Promise<School> {
  const [school] = await db()
    .select()
    .from(schools)
    .where(and(eq(schools.slug, slug), eq(schools.isActive, true)));
  if (!school) throw new NotFound('School not found');
  return school;
}
