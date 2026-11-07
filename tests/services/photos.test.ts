import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANONYMOUS, type UserActor } from '@/server/services/actor';
import { Forbidden, RateLimited, ValidationError } from '@/server/services/errors';
import {
  MAX_PHOTO_PIXELS,
  PHOTO_UPLOADS_PER_HOUR,
  photoUrls,
  processListingUploads,
  requestPhotoUploads,
} from '@/server/services/photos';
import * as storage from '@/server/storage/client';
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

  const jpegs = (count: number) => ({
    files: Array.from({ length: count }, () => ({ contentType: 'image/jpeg' as const, size: 1 })),
  });

  it('limits signed upload URLs to 20 per hour, counted at issuance', async () => {
    const actor = actorFor(newUser());
    await requestPhotoUploads(actor, jpegs(10));
    await requestPhotoUploads(actor, jpegs(PHOTO_UPLOADS_PER_HOUR - 11));
    await expect(requestPhotoUploads(actor, jpegs(1))).resolves.toHaveLength(1);
    const error = await requestPhotoUploads(actor, jpegs(1)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RateLimited);
    expect((error as RateLimited).message).toBe('Too many photo uploads — try again in an hour');
  });

  it('refuses a batch that would go over without using up the rest of the hour', async () => {
    const actor = actorFor(newUser());
    await requestPhotoUploads(actor, jpegs(10));
    await requestPhotoUploads(actor, jpegs(5));
    await expect(requestPhotoUploads(actor, jpegs(6))).rejects.toBeInstanceOf(RateLimited);
    await expect(requestPhotoUploads(actor, jpegs(5))).resolves.toHaveLength(5);
  });

  it('does not count stored objects', async () => {
    const userId = newUser();
    const tiny = Buffer.from('x');
    await Promise.all(
      Array.from({ length: PHOTO_UPLOADS_PER_HOUR }, () => putUpload(userId, tiny)),
    );
    await expect(requestPhotoUploads(actorFor(userId), jpegs(1))).resolves.toHaveLength(1);
  });

  it('issues no URLs on a rejected request', async () => {
    const actor = actorFor(newUser());
    await requestPhotoUploads(actor, jpegs(10));
    await requestPhotoUploads(actor, jpegs(10));
    const signed = vi.spyOn(storage, 'createSignedUploadUrl');
    await expect(requestPhotoUploads(actor, jpegs(1))).rejects.toBeInstanceOf(RateLimited);
    expect(signed).not.toHaveBeenCalled();
    await requestPhotoUploads(actorFor(newUser()), jpegs(1));
    expect(signed).toHaveBeenCalledTimes(1);
    signed.mockRestore();
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

  it('rejects photos over the pixel limit', async () => {
    const userId = newUser();
    const huge = await sharp({
      create: { width: 8000, height: 6000, channels: 3, background: '#808080' },
    })
      .png()
      .toBuffer();
    expect(8000 * 6000).toBeGreaterThan(MAX_PHOTO_PIXELS);
    const path = await putUpload(userId, huge, 'png', 'image/png');
    const listingId = newListingId();
    const error = await processListingUploads(userId, listingId, [path]).catch((e: unknown) => e);
    expect((error as ValidationError).fieldErrors.photos).toEqual([
      'Photos must be under 40 megapixels',
    ]);
  });
});
