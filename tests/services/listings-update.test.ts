import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import type { ListingInput, PhotoRef } from '@/lib/validation/listing';
import { db } from '@/server/db/client';
import { conversations, favorites, listingPhotos, listings } from '@/server/db/schema';
import { Conflict, ListingCapReached, NotFound, ValidationError } from '@/server/services/errors';
import { deleteListing, setListingStatus, updateListing } from '@/server/services/listings';
import { withRollback } from '../helpers/db';
import {
  actorFor,
  createSchool,
  createUser,
  insertListing,
  insertPhoto,
} from '../helpers/fixtures';
import { uploadedPhoto } from '../helpers/listings';
import { BUCKETS, objectExists, uploadObject } from '@/server/storage/client';
import { cleanupStorage } from '../helpers/photos';

type ListingRow = typeof listings.$inferSelect;

const users: string[] = [];
const listingIds: string[] = [];
afterEach(async () => {
  await cleanupStorage({ userIds: users.splice(0), listingIds: listingIds.splice(0) });
});

function editInput(
  row: ListingRow,
  photos: PhotoRef[],
  overrides: Partial<ListingInput> = {},
): ListingInput {
  return {
    schoolId: row.schoolId,
    type: row.type,
    title: row.title,
    description: row.description,
    rentDollars: row.rentCents / 100,
    availableFrom: row.availableFrom,
    availableTo: row.availableTo,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    roommatesCount: row.roommatesCount,
    privateBathroom: row.privateBathroom,
    genderPreference: row.genderPreference,
    address: row.address,
    unit: row.unit ?? '',
    city: row.city,
    state: row.state,
    zip: row.zip,
    location: row.location,
    furnished: row.furnished,
    amenities: row.amenities as ListingInput['amenities'],
    photos,
    ...overrides,
  };
}

async function setup(overrides: Partial<typeof listings.$inferInsert> = {}) {
  const owner = await createUser();
  users.push(owner.id);
  const school = await createSchool();
  const listing = await insertListing(owner.id, school.id, overrides);
  listingIds.push(listing.id);
  const photoA = await insertPhoto(listing.id, 0);
  const photoB = await insertPhoto(listing.id, 1);
  const existing: PhotoRef[] = [
    { kind: 'existing', id: photoA.id },
    { kind: 'existing', id: photoB.id },
  ];
  return { owner, school, listing, existing, photoA, photoB };
}

const yearAhead = (): string => {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
};

const reviewOf = async (id: string) =>
  (await db().select().from(listings).where(eq(listings.id, id)))[0];

describe('updateListing', () => {
  it('only lets the owner edit', () =>
    withRollback(async () => {
      const { listing, existing } = await setup();
      const stranger = await createUser();
      await expect(
        updateListing(actorFor(stranger.id), listing.id, editInput(listing, existing)),
      ).rejects.toBeInstanceOf(NotFound);
      await expect(
        updateListing(actorFor(stranger.id), 'not-a-uuid', editInput(listing, existing)),
      ).rejects.toBeInstanceOf(NotFound);
    }));

  it('sends an approved listing back to review when a reviewed field changes', () =>
    withRollback(async () => {
      const { owner, listing, existing } = await setup({ reviewStatus: 'approved' });
      const result = await updateListing(
        actorFor(owner.id),
        listing.id,
        editInput(listing, existing, { title: 'Bigger sunny studio' }),
      );
      expect(result.reviewStatus).toBe('pending');
      expect(await reviewOf(listing.id)).toMatchObject({
        title: 'Bigger sunny studio',
        reviewStatus: 'pending',
      });
    }));

  it('keeps approval for dates, rooms, amenities, and photo order', () =>
    withRollback(async () => {
      const { owner, listing, existing } = await setup({ reviewStatus: 'approved' });
      const result = await updateListing(
        actorFor(owner.id),
        listing.id,
        editInput(listing, [existing[1], existing[0]], {
          availableTo: yearAhead(),
          bedrooms: 1,
          bathrooms: 1.5,
          furnished: false,
          amenities: ['gym'],
        }),
      );
      expect(result.reviewStatus).toBe('approved');
      const photos = await db()
        .select()
        .from(listingPhotos)
        .where(eq(listingPhotos.listingId, listing.id))
        .orderBy(listingPhotos.position);
      // Photo rows are re-inserted on save, so order is checked by storage path.
      expect(photos.map((photo) => photo.storagePath)).toEqual([
        `${listing.id}/fixture-1`,
        `${listing.id}/fixture-0`,
      ]);
    }));

  it('resubmits a rejected listing and clears the old reason', () =>
    withRollback(async () => {
      const { owner, listing, existing } = await setup({
        reviewStatus: 'rejected',
        reviewNote: 'Blurry photos',
      });
      await updateListing(actorFor(owner.id), listing.id, editInput(listing, existing));
      expect(await reviewOf(listing.id)).toMatchObject({
        reviewStatus: 'pending',
        reviewNote: null,
      });
    }));

  it('leaves a hidden listing hidden', () =>
    withRollback(async () => {
      const { owner, listing, existing } = await setup({ reviewStatus: 'hidden' });
      const result = await updateListing(
        actorFor(owner.id),
        listing.id,
        editInput(listing, existing, { title: 'New title here' }),
      );
      expect(result.reviewStatus).toBe('hidden');
    }));

  it('re-reviews when a photo is added, and processes the new upload', () =>
    withRollback(async () => {
      const { owner, listing, existing } = await setup({ reviewStatus: 'approved' });
      const added = await uploadedPhoto(owner.id);
      const result = await updateListing(
        actorFor(owner.id),
        listing.id,
        editInput(listing, [existing[0], added]),
      );
      expect(result.reviewStatus).toBe('pending');
      const photos = await db()
        .select()
        .from(listingPhotos)
        .where(eq(listingPhotos.listingId, listing.id))
        .orderBy(listingPhotos.position);
      expect(photos).toHaveLength(2);
      expect(photos[0].storagePath).toBe(`${listing.id}/fixture-0`);
      expect(photos[1].storagePath).toMatch(new RegExp(`^${listing.id}/[0-9a-f-]{36}$`));
    }));

  it('keeps approval when a photo is removed', () =>
    withRollback(async () => {
      const { owner, listing, existing } = await setup({ reviewStatus: 'approved' });
      const result = await updateListing(
        actorFor(owner.id),
        listing.id,
        editInput(listing, [existing[1]]),
      );
      expect(result.reviewStatus).toBe('approved');
      const photos = await db()
        .select()
        .from(listingPhotos)
        .where(eq(listingPhotos.listingId, listing.id));
      expect(photos.map((photo) => [photo.position, photo.storagePath])).toEqual([
        [0, `${listing.id}/fixture-1`],
      ]);
    }));

  it('rejects photo ids that belong to another listing', () =>
    withRollback(async () => {
      const { owner, listing, existing } = await setup();
      const other = await setup();
      const error = await updateListing(
        actorFor(owner.id),
        listing.id,
        editInput(listing, [existing[0], other.existing[0]]),
      ).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
    }));

  it('does not re-review when a blank unit is saved against a null unit', () =>
    withRollback(async () => {
      const { owner, listing, existing } = await setup({ reviewStatus: 'approved', unit: null });
      const result = await updateListing(
        actorFor(owner.id),
        listing.id,
        editInput(listing, existing, { unit: '' }),
      );
      expect(result.reviewStatus).toBe('approved');
    }));

  it('rejects a past end date when the end date changes', () =>
    withRollback(async () => {
      const { owner, listing, existing } = await setup();
      const error = await updateListing(
        actorFor(owner.id),
        listing.id,
        editInput(listing, existing, { availableTo: '2000-01-01' }),
      ).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
    }));

  it('rejects duplicate existing photo ids', () =>
    withRollback(async () => {
      const { owner, listing, existing } = await setup();
      const error = await updateListing(
        actorFor(owner.id),
        listing.id,
        editInput(listing, [existing[0], existing[0]]),
      ).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
    }));

  it('conflicts when the review status changed after the edit was loaded', () =>
    withRollback(async () => {
      const { owner, listing, existing } = await setup({ reviewStatus: 'approved' });
      // Stale-read race: updateListing reads the row, then admin hides it before the write.
      const actor = actorFor(owner.id);
      const added = await uploadedPhoto(owner.id);
      const pending = updateListing(actor, listing.id, editInput(listing, [...existing, added]));
      await db()
        .update(listings)
        .set({ reviewStatus: 'hidden' })
        .where(eq(listings.id, listing.id));
      const outcome = await pending.catch((e: unknown) => e);
      expect(outcome).toBeInstanceOf(Conflict);
      expect((await reviewOf(listing.id)).reviewStatus).toBe('hidden');
    }));

  it('blocks resubmitting a rejected listing beyond the cap', () =>
    withRollback(async () => {
      const { owner, school, listing, existing } = await setup({
        reviewStatus: 'rejected',
        reviewNote: 'Fix the title',
      });
      await insertListing(owner.id, school.id);
      await insertListing(owner.id, school.id, { reviewStatus: 'approved' });
      await expect(
        updateListing(actorFor(owner.id), listing.id, editInput(listing, existing)),
      ).rejects.toBeInstanceOf(ListingCapReached);
      expect((await reviewOf(listing.id)).reviewStatus).toBe('rejected');
    }));
});

describe('setListingStatus', () => {
  it('marks taken, then reactivates, without touching review status', () =>
    withRollback(async () => {
      const { owner, listing } = await setup({ reviewStatus: 'approved' });
      await setListingStatus(actorFor(owner.id), { listingId: listing.id, status: 'taken' });
      const taken = await reviewOf(listing.id);
      expect(taken.status).toBe('taken');
      expect(taken.takenAt).toBeInstanceOf(Date);
      expect(taken.reviewStatus).toBe('approved');

      await setListingStatus(actorFor(owner.id), { listingId: listing.id, status: 'active' });
      expect(await reviewOf(listing.id)).toMatchObject({ status: 'active', takenAt: null });
    }));

  it('blocks reactivating beyond the cap', () =>
    withRollback(async () => {
      const { owner, school, listing } = await setup({ status: 'removed' });
      await insertListing(owner.id, school.id);
      await insertListing(owner.id, school.id);
      await expect(
        setListingStatus(actorFor(owner.id), { listingId: listing.id, status: 'active' }),
      ).rejects.toBeInstanceOf(ListingCapReached);
    }));

  it('only lets the owner change status', () =>
    withRollback(async () => {
      const { listing } = await setup();
      const stranger = await createUser();
      await expect(
        setListingStatus(actorFor(stranger.id), { listingId: listing.id, status: 'taken' }),
      ).rejects.toBeInstanceOf(NotFound);
    }));
});

describe('deleteListing', () => {
  it('deletes photos and favorites and keeps conversations without the listing', () =>
    withRollback(async () => {
      const { owner, listing, photoA, photoB } = await setup();
      const objectPaths = [photoA, photoB].flatMap((photo) => [
        `${photo.storagePath}-thumb.webp`,
        `${photo.storagePath}-gallery.webp`,
      ]);
      for (const path of objectPaths) {
        await uploadObject(BUCKETS.listingPhotos, path, Buffer.from('x'), 'image/webp');
      }
      const renter = await createUser();
      await db().insert(favorites).values({ userId: renter.id, listingId: listing.id });
      const [conversation] = await db()
        .insert(conversations)
        .values({ listingId: listing.id, hostId: owner.id, renterId: renter.id })
        .returning();

      await deleteListing(actorFor(owner.id), listing.id);

      expect(await db().select().from(listings).where(eq(listings.id, listing.id))).toEqual([]);
      expect(
        await db().select().from(listingPhotos).where(eq(listingPhotos.listingId, listing.id)),
      ).toEqual([]);
      expect(
        await db().select().from(favorites).where(eq(favorites.listingId, listing.id)),
      ).toEqual([]);
      const [kept] = await db()
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversation.id));
      expect(kept.listingId).toBeNull();
      for (const path of objectPaths) {
        expect(await objectExists(BUCKETS.listingPhotos, path)).toBe(false);
      }
    }));

  it('only lets the owner delete', () =>
    withRollback(async () => {
      const { listing } = await setup();
      const stranger = await createUser();
      await expect(deleteListing(actorFor(stranger.id), listing.id)).rejects.toBeInstanceOf(
        NotFound,
      );
    }));
});
