import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/server/db/client';
import { blocks, favorites, listings } from '@/server/db/schema';
import { ANONYMOUS } from '@/server/services/actor';
import { Forbidden, NotFound, ValidationError } from '@/server/services/errors';
import { listFavorites, setFavorite } from '@/server/services/favorites';
import { getListingDetail } from '@/server/services/listing-reads';
import { withRollback } from '../helpers/db';
import { actorFor, createSchool, createUser, insertListing } from '../helpers/fixtures';
import { RATE_LIMITS } from '@/server/services/rate-limit';
import { expectRateLimited, TOO_FAST } from '../helpers/rate-limit';

const live = { reviewStatus: 'approved' } as const;

async function liveListing(title = 'Saved studio near campus') {
  const owner = await createUser();
  const school = await createSchool();
  const listing = await insertListing(owner.id, school.id, { ...live, title });
  return { owner, school, listing };
}

describe('setFavorite', () => {
  it('saves and unsaves idempotently', () =>
    withRollback(async () => {
      const { listing } = await liveListing();
      const me = actorFor((await createUser()).id);
      await setFavorite(me, { listingId: listing.id, favorited: true });
      await setFavorite(me, { listingId: listing.id, favorited: true });
      expect((await listFavorites(me)).map((card) => card.id)).toEqual([listing.id]);
      await setFavorite(me, { listingId: listing.id, favorited: false });
      await setFavorite(me, { listingId: listing.id, favorited: false });
      expect(await listFavorites(me)).toEqual([]);
    }));

  it('refuses to save listings the viewer cannot see', () =>
    withRollback(async () => {
      const owner = await createUser();
      const school = await createSchool();
      const pending = await insertListing(owner.id, school.id);
      const me = await createUser();
      await expect(
        setFavorite(actorFor(me.id), { listingId: pending.id, favorited: true }),
      ).rejects.toBeInstanceOf(NotFound);

      const { owner: host, listing } = await liveListing();
      await db().insert(blocks).values({ blockerId: host.id, blockedId: me.id });
      await expect(
        setFavorite(actorFor(me.id), { listingId: listing.id, favorited: true }),
      ).rejects.toBeInstanceOf(NotFound);
    }));

  it('lets owners save their own listing', () =>
    withRollback(async () => {
      const { owner, listing } = await liveListing();
      await setFavorite(actorFor(owner.id), { listingId: listing.id, favorited: true });
      expect(await listFavorites(actorFor(owner.id))).toHaveLength(1);
    }));

  it('requires sign-in and valid input', () =>
    withRollback(async () => {
      const { listing } = await liveListing();
      await expect(
        setFavorite(ANONYMOUS, { listingId: listing.id, favorited: true }),
      ).rejects.toBeInstanceOf(Forbidden);
      const me = actorFor((await createUser()).id);
      await expect(setFavorite(me, { listingId: 'nope', favorited: true })).rejects.toBeInstanceOf(
        ValidationError,
      );
    }));
});

describe('listFavorites', () => {
  it('shows only currently visible listings, most recently saved first', () =>
    withRollback(async () => {
      const me = actorFor((await createUser()).id);
      const { listing: first } = await liveListing('First saved place');
      const { listing: second } = await liveListing('Second saved place');
      await setFavorite(me, { listingId: first.id, favorited: true });
      await setFavorite(me, { listingId: second.id, favorited: true });
      await db()
        .update(favorites)
        .set({ createdAt: new Date('2026-01-01T00:00:00Z') })
        .where(eq(favorites.listingId, first.id));

      const saved = await listFavorites(me);
      expect(saved.map((card) => card.title)).toEqual(['Second saved place', 'First saved place']);
      expect(saved.every((card) => card.isFavorited)).toBe(true);
      expect(Object.keys(saved[0])).not.toContain('unit');

      await db().update(listings).set({ status: 'taken' }).where(eq(listings.id, second.id));
      expect((await listFavorites(me)).map((card) => card.id)).toEqual([first.id]);
      await db().update(listings).set({ status: 'active' }).where(eq(listings.id, second.id));
      expect(await listFavorites(me)).toHaveLength(2);
    }));

  it('still lets the user unsave a listing that stopped being public', () =>
    withRollback(async () => {
      const me = actorFor((await createUser()).id);
      const { listing } = await liveListing();
      await setFavorite(me, { listingId: listing.id, favorited: true });
      await db()
        .update(listings)
        .set({ reviewStatus: 'hidden' })
        .where(eq(listings.id, listing.id));
      await setFavorite(me, { listingId: listing.id, favorited: false });
      const rows = await db().select().from(favorites).where(eq(favorites.listingId, listing.id));
      expect(rows).toEqual([]);
    }));
});

describe('getListingDetail isFavorited', () => {
  it('is true only for a viewer who saved the listing', () =>
    withRollback(async () => {
      const { listing } = await liveListing();
      const me = actorFor((await createUser()).id);
      expect((await getListingDetail(me, listing.id)).isFavorited).toBe(false);
      await setFavorite(me, { listingId: listing.id, favorited: true });
      expect((await getListingDetail(me, listing.id)).isFavorited).toBe(true);
      expect((await getListingDetail(ANONYMOUS, listing.id)).isFavorited).toBe(false);
    }));
});

describe('setFavorite rate limit', () => {
  it('allows 20 toggles a minute, then refuses without changing the favorite', () =>
    withRollback(async () => {
      const { listing } = await liveListing();
      const me = actorFor((await createUser()).id);
      for (let i = 0; i < RATE_LIMITS.favorites.limit; i++) {
        await setFavorite(me, { listingId: listing.id, favorited: i % 2 === 0 });
      }
      await expectRateLimited(
        setFavorite(me, { listingId: listing.id, favorited: true }),
        TOO_FAST,
      );
      expect((await getListingDetail(me, listing.id)).isFavorited).toBe(false);
    }));
});
