import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { STALE_AFTER_MS, sweepStaleStorage } from '@/server/services/storage-cleanup';
import { BUCKETS, listObjects, objectExists, uploadObject } from '@/server/storage/client';
import { withRollback } from '../helpers/db';
import { createSchool, createUser, insertListing, insertPhoto } from '../helpers/fixtures';
import { cleanupStorage, putUpload, testUserId } from '../helpers/photos';

const later = (): Date => new Date(Date.now() + STALE_AFTER_MS + 60_000);
const owners = { userIds: [] as string[], listingIds: [] as string[] };

const newUserId = (): string => {
  const id = testUserId();
  owners.userIds.push(id);
  return id;
};

async function newListingId(): Promise<string> {
  const owner = await createUser();
  const school = await createSchool();
  const listing = await insertListing(owner.id, school.id);
  owners.listingIds.push(listing.id);
  return listing.id;
}

const putPhoto = (path: string): Promise<void> =>
  uploadObject(BUCKETS.listingPhotos, path, Buffer.from('webp bytes'), 'image/webp');

afterAll(async () => {
  await cleanupStorage(owners);
});

describe('sweepStaleStorage', () => {
  it('removes raw uploads older than 24 hours', () =>
    withRollback(async () => {
      const userId = newUserId();
      await putUpload(userId, Buffer.from('jpeg bytes'));
      await putUpload(userId, Buffer.from('jpeg bytes'));

      const result = await sweepStaleStorage({
        now: later(),
        scope: { userIds: [userId], listingIds: [] },
      });

      expect(result).toEqual({ uploadsRemoved: 2, photosRemoved: 0 });
      expect(await listObjects(BUCKETS.uploads, `listings/${userId}`)).toEqual([]);
    }));

  it('keeps raw uploads newer than 24 hours', () =>
    withRollback(async () => {
      const userId = newUserId();
      const path = await putUpload(userId, Buffer.from('jpeg bytes'));

      const result = await sweepStaleStorage({ scope: { userIds: [userId], listingIds: [] } });

      expect(result.uploadsRemoved).toBe(0);
      expect(await objectExists(BUCKETS.uploads, path)).toBe(true);
    }));

  it('removes unreferenced processed photos but keeps referenced ones', () =>
    withRollback(async () => {
      const listingId = await newListingId();
      const a = `${listingId}/${randomUUID()}`;
      const b = `${listingId}/${randomUUID()}`;
      for (const base of [a, b]) {
        await putPhoto(`${base}-thumb.webp`);
        await putPhoto(`${base}-gallery.webp`);
      }
      await insertPhoto(listingId, 0, a);

      const result = await sweepStaleStorage({
        now: later(),
        scope: { userIds: [], listingIds: [listingId] },
      });

      expect(result).toEqual({ uploadsRemoved: 0, photosRemoved: 2 });
      expect(await objectExists(BUCKETS.listingPhotos, `${a}-thumb.webp`)).toBe(true);
      expect(await objectExists(BUCKETS.listingPhotos, `${a}-gallery.webp`)).toBe(true);
      expect(await objectExists(BUCKETS.listingPhotos, `${b}-thumb.webp`)).toBe(false);
      expect(await objectExists(BUCKETS.listingPhotos, `${b}-gallery.webp`)).toBe(false);
    }));

  it('keeps a fresh unreferenced photo (mid-save)', () =>
    withRollback(async () => {
      const listingId = await newListingId();
      const path = `${listingId}/${randomUUID()}-thumb.webp`;
      await putPhoto(path);

      const result = await sweepStaleStorage({ scope: { userIds: [], listingIds: [listingId] } });

      expect(result.photosRemoved).toBe(0);
      expect(await objectExists(BUCKETS.listingPhotos, path)).toBe(true);
    }));

  it('leaves folders outside the scope alone', () =>
    withRollback(async () => {
      const userX = newUserId();
      const userY = newUserId();
      const path = await putUpload(userX, Buffer.from('jpeg bytes'));

      await sweepStaleStorage({ now: later(), scope: { userIds: [userY], listingIds: [] } });

      expect(await objectExists(BUCKETS.uploads, path)).toBe(true);
    }));
});
