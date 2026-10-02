import { eq, inArray, sql, type SQL } from 'drizzle-orm';
import { listings, schools, users } from '@/server/db/schema';

const all = (...conditions: SQL[]): SQL =>
  sql.join(
    conditions.map((condition) => sql`(${condition})`),
    sql` and `,
  );

// "Today" is the calendar date at the listing's school. Callers join schools on listings.school_id.
export const schoolToday: SQL = sql`(now() at time zone ${schools.timezone})::date`;

export const isExpired: SQL<boolean> = sql<boolean>`${listings.availableTo} < ${schoolToday}`;

// Callers join schools on listings.school_id and users on listings.owner_id.
export const isPublicListing: SQL = all(
  eq(listings.status, 'active'),
  eq(listings.reviewStatus, 'approved'),
  sql`${listings.availableTo} >= ${schoolToday}`,
  eq(users.status, 'active'),
  eq(schools.isActive, true),
);

// Callers join schools on listings.school_id.
export const countsTowardCap: SQL = all(
  eq(listings.status, 'active'),
  inArray(listings.reviewStatus, ['pending', 'approved', 'hidden']),
  sql`${listings.availableTo} >= ${schoolToday}`,
);
