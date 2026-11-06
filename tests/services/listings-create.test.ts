import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/server/db/client';
import { listingPhotos, listings } from '@/server/db/schema';
import { ANONYMOUS } from '@/server/services/actor';
import {
  Forbidden,
  ListingCapReached,
  RateLimited,
  ValidationError,
} from '@/server/services/errors';
import { createListing } from '@/server/services/listings';
import { processListingUploads } from '@/server/services/photos';
import { BUCKETS, objectExists, removeObjects } from '@/server/storage/client';
import { withRollback } from '../helpers/db';
import { actorFor, createSchool, createUser, insertListing } from '../helpers/fixtures';
import { fakeUpload, listingInput, uploadedPhoto } from '../helpers/listings';
import { cleanupStorage } from '../helpers/photos';

vi.mock('@/server/storage/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/storage/client')>();
  return { ...actual, removeObjects: vi.fn(actual.removeObjects) };
});

vi.mock('@/server/services/photos', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/services/photos')>();
  return { ...actual, processListingUploads: vi.fn(actual.processListingUploads) };
});

const users: string[] = [];
const listingIds: string[] = [];
afterEach(async () => {
  vi.mocked(processListingUploads).mockClear();
  await cleanupStorage({ userIds: users.splice(0), listingIds: listingIds.splice(0) });
});

async function owner(): Promise<string> {
  const user = await createUser();
  users.push(user.id);
  return user.id;
}

// Simulates other creates landing while this one processes its photos, past the pre-check.
function raceFiveCreatesDuringProcessing(ownerId: string, schoolId: string): void {
  vi.mocked(processListingUploads).mockImplementationOnce(async (...args) => {
    for (let i = 0; i < 5; i += 1) {
      await insertListing(ownerId, schoolId, { status: 'removed' });
    }
    const actual = await vi.importActual<typeof import('@/server/services/photos')>(
      '@/server/services/photos',
    );
    return actual.processListingUploads(...args);
  });
}

async function create(ownerId: string, input: unknown) {
  const result = await createListing(actorFor(ownerId), input);
  listingIds.push(result.id);
  return result;
}

describe('createListing', () => {
  it('requires a signed-in user', async () => {
    await expect(createListing(ANONYMOUS, {})).rejects.toBeInstanceOf(Forbidden);
  });

  it('creates a pending listing with normalized fields and processed photos', () =>
    withRollback(async () => {
      const ownerId = await owner();
      const school = await createSchool();
      const first = await uploadedPhoto(ownerId);
      const second = await uploadedPhoto(ownerId);
      const result = await create(
        ownerId,
        listingInput(school.id, [first, second], {
          genderPreference: 'women',
          privateBathroom: true,
          roomType: 'shared',
          roomFeatures: ['desk', 'desk', 'lamp'],
          unit: '  ',
          amenities: ['gym', 'dishwasher', 'gym'],
        }),
      );
      expect(result.schoolSlug).toBe(school.slug);

      const [row] = await db().select().from(listings).where(eq(listings.id, result.id));
      expect(row).toMatchObject({
        ownerId,
        reviewStatus: 'pending',
        status: 'active',
        rentCents: 95_000,
        genderPreference: 'women',
        privateBathroom: null,
        roomType: 'shared',
        roomFeatures: ['desk', 'lamp'],
        unit: null,
        amenities: ['gym', 'dishwasher'],
      });

      const photos = await db()
        .select()
        .from(listingPhotos)
        .where(eq(listingPhotos.listingId, result.id))
        .orderBy(listingPhotos.position);
      expect(photos.map((photo) => photo.position)).toEqual([0, 1]);
      for (const photo of photos) {
        expect(photo.storagePath.startsWith(`${result.id}/`)).toBe(true);
        expect(await objectExists(BUCKETS.listingPhotos, `${photo.storagePath}-thumb.webp`)).toBe(
          true,
        );
      }
      for (const ref of [first, second]) {
        if (ref.kind === 'upload')
          expect(await objectExists(BUCKETS.uploads, ref.path)).toBe(false);
      }
    }));

  it('keeps the gender preference and private bathroom when there are roommates', () =>
    withRollback(async () => {
      const ownerId = await owner();
      const school = await createSchool();
      const result = await create(
        ownerId,
        listingInput(school.id, [await uploadedPhoto(ownerId)], {
          roommatesCount: 2,
          privateBathroom: false,
          genderPreference: 'women',
        }),
      );
      const [row] = await db().select().from(listings).where(eq(listings.id, result.id));
      expect(row).toMatchObject({ genderPreference: 'women', privateBathroom: false });
    }));

  it('rejects an end date that has passed in the school timezone', () =>
    withRollback(async () => {
      const ownerId = await owner();
      const school = await createSchool();
      const error = await createListing(
        actorFor(ownerId),
        listingInput(school.id, [fakeUpload(ownerId)], {
          availableFrom: '2020-01-01',
          availableTo: '2020-02-01',
        }),
      ).catch((e: unknown) => e);
      expect((error as ValidationError).fieldErrors).toEqual({
        availableTo: ['The end date has already passed'],
      });
    }));

  it('rejects inactive schools', () =>
    withRollback(async () => {
      const ownerId = await owner();
      const school = await createSchool({ isActive: false });
      const error = await createListing(
        actorFor(ownerId),
        listingInput(school.id, [fakeUpload(ownerId)]),
      ).catch((e: unknown) => e);
      expect((error as ValidationError).fieldErrors).toEqual({ schoolId: ['Choose a school'] });
    }));

  it('rejects existing-photo references and other users’ uploads', () =>
    withRollback(async () => {
      const ownerId = await owner();
      const school = await createSchool();
      const existing = await createListing(
        actorFor(ownerId),
        listingInput(school.id, [{ kind: 'existing', id: '0f8fad5b-d9cb-469f-a165-70867728950e' }]),
      ).catch((e: unknown) => e);
      expect(existing).toBeInstanceOf(ValidationError);

      const stranger = await owner();
      const foreign = await createListing(
        actorFor(ownerId),
        listingInput(school.id, [await uploadedPhoto(stranger)]),
      ).catch((e: unknown) => e);
      expect(foreign).toBeInstanceOf(ValidationError);
    }));

  it('enforces the cap of 1 counting listing', () =>
    withRollback(async () => {
      const ownerId = await owner();
      const school = await createSchool();
      await insertListing(ownerId, school.id, { reviewStatus: 'approved' });
      await expect(
        createListing(actorFor(ownerId), listingInput(school.id, [fakeUpload(ownerId)])),
      ).rejects.toBeInstanceOf(ListingCapReached);
    }));

  it('lets admins post past the cap', () =>
    withRollback(async () => {
      const ownerId = await owner();
      const school = await createSchool();
      await insertListing(ownerId, school.id, { reviewStatus: 'approved' });
      const result = await createListing(
        actorFor(ownerId, true),
        listingInput(school.id, [await uploadedPhoto(ownerId)]),
      );
      listingIds.push(result.id);
      expect(result.schoolSlug).toBe(school.slug);
    }));

  it('does not apply the daily rate limit to admins', () =>
    withRollback(async () => {
      const ownerId = await owner();
      const school = await createSchool();
      for (let i = 0; i < 5; i += 1) {
        await insertListing(ownerId, school.id, { status: 'removed' });
      }
      const result = await createListing(
        actorFor(ownerId, true),
        listingInput(school.id, [await uploadedPhoto(ownerId)]),
      );
      listingIds.push(result.id);

      const studentId = await owner();
      for (let i = 0; i < 5; i += 1) {
        await insertListing(studentId, school.id, { status: 'removed' });
      }
      await expect(
        createListing(actorFor(studentId), listingInput(school.id, [fakeUpload(studentId)])),
      ).rejects.toBeInstanceOf(RateLimited);
    }));

  it('keeps students to their home school but not admins', () =>
    withRollback(async () => {
      const home = await createSchool();
      const other = await createSchool();
      const user = await createUser({ homeSchoolId: home.id });
      users.push(user.id);
      await expect(
        createListing(actorFor(user.id), listingInput(other.id, [fakeUpload(user.id)])),
      ).rejects.toBeInstanceOf(ValidationError);
      const result = await createListing(
        actorFor(user.id, true),
        listingInput(other.id, [await uploadedPhoto(user.id)]),
      );
      listingIds.push(result.id);
    }));

  it('does not count rejected, taken, removed, or expired listings', () =>
    withRollback(async () => {
      const ownerId = await owner();
      const school = await createSchool();
      // Backdated so the daily rate limit does not fire before the cap is exercised.
      const createdAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      await insertListing(ownerId, school.id, {
        reviewStatus: 'rejected',
        reviewNote: 'No',
        createdAt,
      });
      await insertListing(ownerId, school.id, { status: 'taken', createdAt });
      await insertListing(ownerId, school.id, { status: 'removed', createdAt });
      await insertListing(ownerId, school.id, {
        availableFrom: '2020-01-01',
        availableTo: '2020-06-01',
        createdAt,
      });
      await expect(
        create(ownerId, listingInput(school.id, [await uploadedPhoto(ownerId)])),
      ).resolves.toMatchObject({ schoolSlug: school.slug });
    }));

  it('allows at most 5 new listings per rolling 24 hours, without processing photos', () =>
    withRollback(async () => {
      const ownerId = await owner();
      const school = await createSchool();
      for (let i = 0; i < 5; i += 1) {
        await insertListing(ownerId, school.id, { status: 'removed' });
      }
      await expect(
        createListing(actorFor(ownerId), listingInput(school.id, [await uploadedPhoto(ownerId)])),
      ).rejects.toBeInstanceOf(RateLimited);
      expect(processListingUploads).not.toHaveBeenCalled();
    }));

  it('re-checks the rate limit after processing, for a create that raced past the pre-check', () =>
    withRollback(async () => {
      const ownerId = await owner();
      const school = await createSchool();
      const photo = await uploadedPhoto(ownerId);
      raceFiveCreatesDuringProcessing(ownerId, school.id);
      await expect(
        createListing(actorFor(ownerId), listingInput(school.id, [photo])),
      ).rejects.toBeInstanceOf(RateLimited);
      expect(processListingUploads).toHaveBeenCalledTimes(1);
      if (photo.kind === 'upload')
        expect(await objectExists(BUCKETS.uploads, photo.path)).toBe(true);
    }));

  it('still succeeds when deleting the consumed uploads fails', () =>
    withRollback(async () => {
      const ownerId = await owner();
      const school = await createSchool();
      const photo = await uploadedPhoto(ownerId);
      vi.mocked(removeObjects).mockRejectedValueOnce(new Error('storage down'));
      const result = await create(ownerId, listingInput(school.id, [photo]));
      const rows = await db().select().from(listings).where(eq(listings.id, result.id));
      expect(rows).toHaveLength(1);
    }));

  it('rethrows the original error when photo cleanup also fails', () =>
    withRollback(async () => {
      const ownerId = await owner();
      const school = await createSchool();
      const photo = await uploadedPhoto(ownerId);
      raceFiveCreatesDuringProcessing(ownerId, school.id);
      vi.mocked(removeObjects).mockRejectedValueOnce(new Error('storage down'));
      await expect(
        createListing(actorFor(ownerId), listingInput(school.id, [photo])),
      ).rejects.toBeInstanceOf(RateLimited);
    }));
});
