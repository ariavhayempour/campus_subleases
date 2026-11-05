import { and, eq } from 'drizzle-orm';
import { db, type DbExecutor } from '@/server/db/client';
import { listingPhotos, listings, schools, users } from '@/server/db/schema';
import { formatDisplayName } from '@/lib/display-name';
import { onboardingSchema } from '@/lib/validation/onboarding';
import { requireUser, type Actor, type UserActor } from './actor';
import { bestEffort } from './best-effort';
import { parseInput, ValidationError } from './errors';
import { deleteProcessedPhotos } from './photos';

export type UserRow = typeof users.$inferSelect;
export type ClerkUserNames = { firstName: string | null; lastName: string | null };
export type ClerkUserSnapshot = ClerkUserNames & { id: string; banned: boolean };

const nameColumns = ({ firstName, lastName }: ClerkUserNames) => ({
  firstName: firstName?.trim() || null,
  lastName: lastName?.trim() || null,
  displayName: formatDisplayName(firstName, lastName),
});

export async function syncUserFromClerk(
  snapshot: ClerkUserSnapshot,
  executor: DbExecutor = db(),
): Promise<void> {
  const values = {
    ...nameColumns(snapshot),
    status: snapshot.banned ? 'banned' : 'active',
  } as const;
  await executor
    .insert(users)
    .values({ id: snapshot.id, ...values })
    .onConflictDoUpdate({ target: users.id, set: { ...values, updatedAt: new Date() } });
}

export async function deleteUserFromClerk(userId: string): Promise<void> {
  const paths = await db().transaction(async (tx) => {
    const photos = await tx
      .select({ storagePath: listingPhotos.storagePath })
      .from(listingPhotos)
      .innerJoin(listings, eq(listings.id, listingPhotos.listingId))
      .where(eq(listings.ownerId, userId));
    await tx.delete(users).where(eq(users.id, userId));
    return photos.map((photo) => photo.storagePath);
  });
  await bestEffort(() => deleteProcessedPhotos(paths));
}

export async function getUserById(userId: string): Promise<UserRow | null> {
  const [row] = await db().select().from(users).where(eq(users.id, userId));
  return row ?? null;
}

// Covers webhook delay and local development, where the Clerk webhook may never arrive.
export async function ensureUser(snapshot: ClerkUserNames & { id: string }): Promise<UserRow> {
  await db()
    .insert(users)
    .values({ id: snapshot.id, ...nameColumns(snapshot) })
    .onConflictDoNothing();
  const row = await getUserById(snapshot.id);
  if (!row) throw new Error(`Could not create user ${snapshot.id}`);
  return row;
}

export async function getOnboardingState(
  actor: UserActor,
): Promise<{ needsOnboarding: boolean; homeSchoolSlug: string | null }> {
  const [row] = await db()
    .select({
      homeSchoolId: users.homeSchoolId,
      schoolSlug: schools.slug,
      schoolActive: schools.isActive,
    })
    .from(users)
    .leftJoin(schools, eq(schools.id, users.homeSchoolId))
    .where(eq(users.id, actor.userId));
  return {
    needsOnboarding: !row?.homeSchoolId,
    homeSchoolSlug: row?.schoolActive ? (row.schoolSlug ?? null) : null,
  };
}

export async function completeOnboarding(
  actor: Actor,
  input: unknown,
): Promise<{ schoolSlug: string }> {
  const user = requireUser(actor);
  const data = parseInput(onboardingSchema, input);
  const [school] = await db()
    .select({ id: schools.id, slug: schools.slug })
    .from(schools)
    .where(and(eq(schools.id, data.homeSchoolId), eq(schools.isActive, true)));
  if (!school) throw new ValidationError({ homeSchoolId: ['Choose your school'] });
  await db()
    .update(users)
    .set({ homeSchoolId: school.id, updatedAt: new Date() })
    .where(eq(users.id, user.userId));
  return { schoolSlug: school.slug };
}
