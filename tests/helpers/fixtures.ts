import { db } from '@/server/db/client';
import { schools, users } from '@/server/db/schema';

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
