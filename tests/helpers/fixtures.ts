import { db } from '@/server/db/client';
import { listings, schools, users } from '@/server/db/schema';

let sequence = 0;
const nextId = (): string => `${Date.now().toString(36)}${(sequence += 1)}`;

export async function createUser(
  overrides: Partial<typeof users.$inferInsert> = {},
): Promise<typeof users.$inferSelect> {
  const id = nextId();
  const [row] = await db()
    .insert(users)
    .values({ id: `user_test_${id}`, username: `tester_${id}`, ...overrides })
    .returning();
  return row;
}

export async function createSchool(
  overrides: Partial<typeof schools.$inferInsert> = {},
): Promise<typeof schools.$inferSelect> {
  const id = nextId();
  const [row] = await db()
    .insert(schools)
    .values({
      slug: `test-school-${id}`,
      name: `Test School ${id}`,
      campusLocation: { lng: -89.404, lat: 43.0753 },
      defaultMapZoom: 13,
      timezone: 'America/Chicago',
      ...overrides,
    })
    .returning();
  return row;
}

export function listingValues(
  ownerId: string,
  schoolId: string,
  overrides: Partial<typeof listings.$inferInsert> = {},
): typeof listings.$inferInsert {
  return {
    ownerId,
    schoolId,
    type: 'apartment',
    title: 'Sunny studio near campus',
    description: 'Bright studio with big windows, five minutes from campus.',
    rentCents: 95_000,
    availableFrom: '2027-01-01',
    availableTo: '2027-05-31',
    bedrooms: 0,
    bathrooms: 1,
    roommatesCount: 0,
    privateBathroom: null,
    address: '123 State St',
    city: 'Madison',
    state: 'WI',
    zip: '53703',
    location: { lng: -89.39, lat: 43.07 },
    furnished: true,
    ...overrides,
  };
}
