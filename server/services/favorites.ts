import { and, desc, eq, sql } from 'drizzle-orm';
import { favoriteInputSchema } from '@/lib/validation/favorite';
import { db } from '@/server/db/client';
import { favorites, listingPhotos, listings, schools, users } from '@/server/db/schema';
import { requireUser, type Actor } from './actor';
import { NotFound, parseInput } from './errors';
import { CARD_COLUMNS, coverJoin, toListingCard, type ListingCard } from './listing-cards';
import { isPublicListing, noBlockWith } from './listing-sql';
import { assertInHomeSchool } from './school-lock';

const MAX_FAVORITES_SHOWN = 200;

export async function setFavorite(actor: Actor, input: unknown): Promise<void> {
  const user = requireUser(actor);
  const { listingId, favorited } = parseInput(favoriteInputSchema, input);
  if (!favorited) {
    await db()
      .delete(favorites)
      .where(and(eq(favorites.userId, user.userId), eq(favorites.listingId, listingId)));
    return;
  }
  const [visible] = await db()
    .select({ id: listings.id, schoolId: listings.schoolId })
    .from(listings)
    .innerJoin(schools, eq(schools.id, listings.schoolId))
    .innerJoin(users, eq(users.id, listings.ownerId))
    .where(and(eq(listings.id, listingId), isPublicListing, noBlockWith(user.userId)));
  if (!visible) throw new NotFound('Listing not found');
  await assertInHomeSchool(user, visible.schoolId);
  await db().insert(favorites).values({ userId: user.userId, listingId }).onConflictDoNothing();
}

export async function listFavorites(actor: Actor): Promise<ListingCard[]> {
  const user = requireUser(actor);
  const rows = await db()
    .select({ ...CARD_COLUMNS, isFavorited: sql<boolean>`true` })
    .from(favorites)
    .innerJoin(listings, eq(listings.id, favorites.listingId))
    .innerJoin(schools, eq(schools.id, listings.schoolId))
    .innerJoin(users, eq(users.id, listings.ownerId))
    .leftJoin(listingPhotos, coverJoin)
    .where(and(eq(favorites.userId, user.userId), isPublicListing, noBlockWith(user.userId)))
    .orderBy(desc(favorites.createdAt))
    .limit(MAX_FAVORITES_SHOWN);
  return rows.map(toListingCard);
}
