import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/server/db/client';
import { blocks, conversations, listings } from '@/server/db/schema';
import { ANONYMOUS } from '@/server/services/actor';
import { NotFound } from '@/server/services/errors';
import {
  getListingDetail,
  getListingForEdit,
  getListingFormContext,
  listMyListings,
} from '@/server/services/listing-reads';
import { withRollback } from '../helpers/db';
import {
  actorFor,
  createSchool,
  createUser,
  insertListing,
  insertPhoto,
} from '../helpers/fixtures';

const live = { reviewStatus: 'approved', unit: '4B' } as const;

async function hostWithListing(overrides: Parameters<typeof insertListing>[2] = live) {
  const owner = await createUser();
  const school = await createSchool();
  const listing = await insertListing(owner.id, school.id, overrides);
  return { owner, school, listing };
}

describe('getListingDetail visibility', () => {
  it('returns the renter conversation id, and the unit with it', () =>
    withRollback(async () => {
      const { owner, listing } = await hostWithListing();
      const renter = await createUser();
      const before = await getListingDetail(actorFor(renter.id), listing.id);
      expect(before).toMatchObject({ conversationId: null, unit: null });
      const [conversation] = await db()
        .insert(conversations)
        .values({ listingId: listing.id, hostId: owner.id, renterId: renter.id })
        .returning();
      const after = await getListingDetail(actorFor(renter.id), listing.id);
      expect(after).toMatchObject({ conversationId: conversation.id, unit: '4B' });
      const ownerView = await getListingDetail(actorFor(owner.id), listing.id);
      expect(ownerView.conversationId).toBeNull();
    }));

  it('shows a public listing to anyone, without the unit', () =>
    withRollback(async () => {
      const { listing } = await hostWithListing();
      const detail = await getListingDetail(ANONYMOUS, listing.id);
      expect(detail).toMatchObject({
        id: listing.id,
        unit: null,
        isPublic: true,
        viewer: 'visitor',
      });
      const signedIn = await createUser();
      expect((await getListingDetail(actorFor(signedIn.id), listing.id)).unit).toBeNull();
    }));

  it('hides non-public listings from everyone but the owner and admins', () =>
    withRollback(async () => {
      const hidden = [
        { reviewStatus: 'pending' },
        { reviewStatus: 'rejected', reviewNote: 'No' },
        { reviewStatus: 'hidden' },
        { reviewStatus: 'approved', status: 'taken' },
        { reviewStatus: 'approved', status: 'removed' },
        { reviewStatus: 'approved', availableFrom: '2020-01-01', availableTo: '2020-06-01' },
      ] as const;
      const admin = await createUser();
      for (const overrides of hidden) {
        const { owner, listing } = await hostWithListing({ ...overrides, unit: '4B' });
        await expect(getListingDetail(ANONYMOUS, listing.id)).rejects.toBeInstanceOf(NotFound);
        const ownView = await getListingDetail(actorFor(owner.id), listing.id);
        expect(ownView).toMatchObject({ viewer: 'owner', unit: '4B', isPublic: false });
        const adminView = await getListingDetail(actorFor(admin.id, true), listing.id);
        expect(adminView).toMatchObject({ viewer: 'admin', unit: '4B' });
      }
    }));

  it('hides listings of banned owners and inactive schools', () =>
    withRollback(async () => {
      const banned = await createUser({ status: 'banned' });
      const school = await createSchool();
      const listing = await insertListing(banned.id, school.id, live);
      await expect(getListingDetail(ANONYMOUS, listing.id)).rejects.toBeInstanceOf(NotFound);

      const owner = await createUser();
      const closed = await createSchool({ isActive: false });
      const closedListing = await insertListing(owner.id, closed.id, live);
      await expect(getListingDetail(ANONYMOUS, closedListing.id)).rejects.toBeInstanceOf(NotFound);
    }));

  it('uses the school timezone for "today"', () =>
    withRollback(async () => {
      const [{ today, yesterday }] = await db().execute<{ today: string; yesterday: string }>(
        sql`select (now() at time zone 'America/Los_Angeles')::date::text as today,
                   ((now() at time zone 'America/Los_Angeles')::date - 1)::text as yesterday`,
      );
      const owner = await createUser();
      const school = await createSchool({ timezone: 'America/Los_Angeles' });
      const endsToday = await insertListing(owner.id, school.id, {
        ...live,
        availableFrom: '2020-01-01',
        availableTo: today,
      });
      const endedYesterday = await insertListing(owner.id, school.id, {
        ...live,
        availableFrom: '2020-01-01',
        availableTo: yesterday,
      });
      expect((await getListingDetail(ANONYMOUS, endsToday.id)).isPublic).toBe(true);
      await expect(getListingDetail(ANONYMOUS, endedYesterday.id)).rejects.toBeInstanceOf(NotFound);
    }));

  it('shows the unit to a renter with a conversation on the listing', () =>
    withRollback(async () => {
      const { owner, listing } = await hostWithListing();
      const renter = await createUser();
      await db()
        .insert(conversations)
        .values({ listingId: listing.id, hostId: owner.id, renterId: renter.id });
      expect((await getListingDetail(actorFor(renter.id), listing.id)).unit).toBe('4B');
    }));

  it('hides listings when a block exists in either direction', () =>
    withRollback(async () => {
      const { owner, listing } = await hostWithListing();
      const blocker = await createUser();
      const blocked = await createUser();
      await db()
        .insert(blocks)
        .values([
          { blockerId: blocker.id, blockedId: owner.id },
          { blockerId: owner.id, blockedId: blocked.id },
        ]);
      await expect(getListingDetail(actorFor(blocker.id), listing.id)).rejects.toBeInstanceOf(
        NotFound,
      );
      await expect(getListingDetail(actorFor(blocked.id), listing.id)).rejects.toBeInstanceOf(
        NotFound,
      );
    }));

  it('returns ordered photo URLs, the host, and the distance to campus', () =>
    withRollback(async () => {
      const { owner, listing } = await hostWithListing();
      await insertPhoto(listing.id, 1, `${listing.id}/second`);
      await insertPhoto(listing.id, 0, `${listing.id}/cover`);
      const detail = await getListingDetail(ANONYMOUS, listing.id);
      expect(detail.photos.map((photo) => photo.thumbUrl)).toEqual([
        expect.stringMatching(/\/cover-thumb\.webp$/),
        expect.stringMatching(/\/second-thumb\.webp$/),
      ]);
      expect(detail.host.displayName).toBe(owner.displayName);
      // Fixture listing (-89.39, 43.07) vs fixture campus (-89.404, 43.0753): about 1.3 km.
      expect(detail.distanceKm).toBeGreaterThan(1);
      expect(detail.distanceKm).toBeLessThan(1.6);
    }));

  it('treats malformed ids as not found', async () => {
    await expect(getListingDetail(ANONYMOUS, 'nope')).rejects.toBeInstanceOf(NotFound);
  });
});

describe('owner views', () => {
  it('lists only my listings with expiry and cover', () =>
    withRollback(async () => {
      const { owner, school, listing } = await hostWithListing({ reviewStatus: 'pending' });
      await insertPhoto(listing.id, 0, `${listing.id}/cover`);
      const expired = await insertListing(owner.id, school.id, {
        availableFrom: '2020-01-01',
        availableTo: '2020-06-01',
      });
      await hostWithListing();
      const mine = await listMyListings(actorFor(owner.id));
      expect(mine.map((row) => row.id).sort()).toEqual([listing.id, expired.id].sort());
      expect(mine.find((row) => row.id === expired.id)).toMatchObject({
        isExpired: true,
        coverThumbUrl: null,
      });
      expect(mine.find((row) => row.id === listing.id)?.coverThumbUrl).toMatch(
        /\/cover-thumb\.webp$/,
      );
    }));

  it('reads a legacy room listing as an apartment and drops amenities outside the set', () =>
    withRollback(async () => {
      const { owner, listing } = await hostWithListing();
      await insertPhoto(listing.id, 0);
      await db()
        .update(listings)
        .set({ type: 'room', amenities: ['gym', 'garage'], roomFeatures: ['desk', 'hot_tub'] })
        .where(eq(listings.id, listing.id));
      const edit = await getListingForEdit(actorFor(owner.id), listing.id);
      expect(edit.values).toMatchObject({
        type: 'apartment',
        amenities: ['gym'],
        roomType: 'single',
        roomFeatures: ['desk'],
      });
      const detail = await getListingDetail(actorFor(owner.id), listing.id);
      expect(detail).toMatchObject({
        type: 'apartment',
        roomType: 'single',
        roomFeatures: ['desk'],
      });
    }));

  it('loads edit data only for the owner', () =>
    withRollback(async () => {
      const { owner, listing } = await hostWithListing();
      const photo = await insertPhoto(listing.id, 0);
      const edit = await getListingForEdit(actorFor(owner.id), listing.id);
      expect(edit.values).toMatchObject({
        rentDollars: 950,
        unit: '4B',
        photos: [{ kind: 'existing', id: photo.id }],
      });
      const stranger = await createUser();
      await expect(getListingForEdit(actorFor(stranger.id), listing.id)).rejects.toBeInstanceOf(
        NotFound,
      );
    }));

  it('reports the cap and the home school for the form', () =>
    withRollback(async () => {
      const school = await createSchool();
      const owner = await createUser({ homeSchoolId: school.id });
      expect(await getListingFormContext(actorFor(owner.id))).toMatchObject({
        homeSchoolId: school.id,
        atCap: false,
      });
      await insertListing(owner.id, school.id);
      expect((await getListingFormContext(actorFor(owner.id))).atCap).toBe(true);
    }));

  it('exempts admins from the cap and offers students only their home school', () =>
    withRollback(async () => {
      const home = await createSchool();
      const other = await createSchool();
      const user = await createUser({ homeSchoolId: home.id });
      await insertListing(user.id, home.id);
      const admin = await getListingFormContext(actorFor(user.id, true));
      expect(admin.atCap).toBe(false);
      expect(admin.schools.map((s) => s.id)).toEqual(expect.arrayContaining([home.id, other.id]));
      const student = await getListingFormContext(actorFor(user.id));
      expect(student.schools.map((s) => s.id)).toEqual([home.id]);
    }));
});
