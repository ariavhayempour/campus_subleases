import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { ANONYMOUS, type UserActor } from '@/server/services/actor';
import { Forbidden, RateLimited, ValidationError } from '@/server/services/errors';
import {
  PHOTO_UPLOADS_PER_HOUR,
  photoUrls,
  processListingUploads,
  requestPhotoUploads,
} from '@/server/services/photos';
import { BUCKETS, downloadObject, objectExists } from '@/server/storage/client';
import { cleanupStorage, jpegWithGps, putUpload, testUserId } from '../helpers/photos';

const users: string[] = [];
const listings: string[] = [];
const newUser = (): string => {
  const id = testUserId();
  users.push(id);
  return id;
};
const newListingId = (): string => {
  const id = randomUUID();
  listings.push(id);
  return id;
};
const actorFor = (userId: string): UserActor => ({ kind: 'user', userId, isAdmin: false });

afterEach(async () => {
  await cleanupStorage({ userIds: users.splice(0), listingIds: listings.splice(0) });
});

describe('requestPhotoUploads', () => {
  it('requires a signed-in user', async () => {
    await expect(
      requestPhotoUploads(ANONYMOUS, { files: [{ contentType: 'image/jpeg', size: 10 }] }),
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it('issues signed URLs under the user prefix with the right extension', async () => {
    const userId = newUser();
    const targets = await requestPhotoUploads(actorFor(userId), {
      files: [
        { contentType: 'image/jpeg', size: 1000 },
        { contentType: 'image/webp', size: 1000 },
      ],
    });
    expect(targets).toHaveLength(2);
    expect(targets[0].path).toMatch(new RegExp(`^listings/${userId}/[0-9a-f-]{36}\\.jpg$`));
    expect(targets[1].path).toMatch(/\.webp$/);
    const response = await fetch(targets[0].signedUrl, {
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
      body: new Uint8Array(await jpegWithGps()),
    });
    expect(response.ok).toBe(true);
  });

  it('rejects unsupported photo types', async () => {
    const error = await requestPhotoUploads(actorFor(newUser()), {
      files: [{ contentType: 'image/heic', size: 1000 }],
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
  });

  it('allows at most 20 uploads per rolling hour', async () => {
    const userId = newUser();
    const tiny = Buffer.from('x');
    await Promise.all(
      Array.from({ length: PHOTO_UPLOADS_PER_HOUR - 1 }, () => putUpload(userId, tiny)),
    );
    await expect(
      requestPhotoUploads(actorFor(userId), {
        files: [
          { contentType: 'image/jpeg', size: 1 },
          { contentType: 'image/jpeg', size: 1 },
        ],
      }),
    ).rejects.toBeInstanceOf(RateLimited);
    await expect(
      requestPhotoUploads(actorFor(userId), { files: [{ contentType: 'image/jpeg', size: 1 }] }),
    ).resolves.toHaveLength(1);
  });
});

describe('processListingUploads', () => {
  it('re-encodes to two WebP sizes with EXIF (including GPS) stripped', async () => {
    const userId = newUser();
    const source = await jpegWithGps();
    expect((await sharp(source).metadata()).exif).toBeDefined();
    const path = await putUpload(userId, source);
    const listingId = newListingId();

    const [base] = await processListingUploads(userId, listingId, [path]);
    expect(base).toMatch(new RegExp(`^${listingId}/[0-9a-f-]{36}$`));

    const thumb = await sharp(
      await downloadObject(BUCKETS.listingPhotos, `${base}-thumb.webp`),
    ).metadata();
    expect(thumb).toMatchObject({ format: 'webp', width: 640, height: 480 });
    expect(thumb.exif).toBeUndefined();

    const gallery = await sharp(
      await downloadObject(BUCKETS.listingPhotos, `${base}-gallery.webp`),
    ).metadata();
    expect(gallery).toMatchObject({ format: 'webp', width: 800, height: 600 });
    expect(gallery.exif).toBeUndefined();

    expect(photoUrls(base).thumb).toMatch(/\/listing-photos\/.+-thumb\.webp$/);
  });

  it('rejects paths outside the actor prefix', async () => {
    const owner = newUser();
    const path = await putUpload(owner, await jpegWithGps());
    const error = await processListingUploads(newUser(), newListingId(), [path]).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ValidationError);
  });

  it('rejects missing uploads', async () => {
    const userId = newUser();
    const error = await processListingUploads(userId, newListingId(), [
      `listings/${userId}/${randomUUID()}.jpg`,
    ]).catch((e: unknown) => e);
    expect((error as ValidationError).fieldErrors.photos).toEqual([
      'A photo upload is missing — add it again',
    ]);
  });

  it('rejects files that are not JPEG, PNG, or WebP', async () => {
    const userId = newUser();
    const gif = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#000' } })
      .gif()
      .toBuffer();
    const gifPath = await putUpload(userId, gif);
    const textPath = await putUpload(userId, Buffer.from('not an image'));
    for (const path of [gifPath, textPath]) {
      const error = await processListingUploads(userId, newListingId(), [path]).catch(
        (e: unknown) => e,
      );
      expect((error as ValidationError).fieldErrors.photos).toEqual([
        'Use JPEG, PNG, or WebP photos',
      ]);
    }
    expect(await objectExists(BUCKETS.uploads, gifPath)).toBe(true);
  });
});
