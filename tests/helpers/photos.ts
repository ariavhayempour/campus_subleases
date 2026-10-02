import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { BUCKETS, listObjects, removeObjects, uploadObject } from '@/server/storage/client';

export const testUserId = (): string => `user_phototest${randomUUID().replaceAll('-', '')}`;

export function jpegWithGps(width = 800, height = 600): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#4a7' } })
    .jpeg()
    .withExif({
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '43/1 4/1 31/1',
        GPSLongitudeRef: 'W',
        GPSLongitude: '89/1 24/1 14/1',
      },
    })
    .toBuffer();
}

export async function putUpload(
  userId: string,
  body: Buffer,
  ext = 'jpg',
  contentType = 'image/jpeg',
): Promise<string> {
  const path = `listings/${userId}/${randomUUID()}.${ext}`;
  await uploadObject(BUCKETS.uploads, path, body, contentType);
  return path;
}

// Storage writes are not rolled back with the test transaction.
export async function cleanupStorage(owners: {
  userIds?: string[];
  listingIds?: string[];
}): Promise<void> {
  for (const userId of owners.userIds ?? []) {
    const objects = await listObjects(BUCKETS.uploads, `listings/${userId}`);
    await removeObjects(
      BUCKETS.uploads,
      objects.map((object) => object.path),
    );
  }
  for (const listingId of owners.listingIds ?? []) {
    const objects = await listObjects(BUCKETS.listingPhotos, listingId);
    await removeObjects(
      BUCKETS.listingPhotos,
      objects.map((object) => object.path),
    );
  }
}
