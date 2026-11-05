import { inArray } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { listingPhotos } from '@/server/db/schema';
import {
  BUCKETS,
  type Bucket,
  listFolders,
  listObjects,
  removeObjects,
  type StoredObject,
} from '@/server/storage/client';

// Grace period that protects uploads awaiting a save and photos written mid-save.
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export type CleanupScope = { userIds: string[]; listingIds: string[] };
export type CleanupResult = { uploadsRemoved: number; photosRemoved: number };

const UPLOADS_ROOT = 'listings';
const PHOTO_SUFFIX = /-(thumb|gallery)\.webp$/;

async function staleObjects(name: Bucket, folder: string, cutoff: Date): Promise<StoredObject[]> {
  const objects = await listObjects(name, folder);
  return objects.filter((object) => object.createdAt < cutoff);
}

async function sweepUploads(userIds: string[], cutoff: Date): Promise<number> {
  let removed = 0;
  for (const userId of userIds) {
    const stale = await staleObjects(BUCKETS.uploads, `${UPLOADS_ROOT}/${userId}`, cutoff);
    await removeObjects(
      BUCKETS.uploads,
      stale.map((object) => object.path),
    );
    removed += stale.length;
  }
  return removed;
}

async function referencedBases(bases: string[]): Promise<Set<string>> {
  if (bases.length === 0) return new Set();
  const rows = await db()
    .select({ storagePath: listingPhotos.storagePath })
    .from(listingPhotos)
    .where(inArray(listingPhotos.storagePath, bases));
  return new Set(rows.map((row) => row.storagePath));
}

const basePath = (path: string): string => path.replace(PHOTO_SUFFIX, '');

async function sweepPhotos(listingIds: string[], cutoff: Date): Promise<number> {
  let removed = 0;
  for (const listingId of listingIds) {
    const stale = (await staleObjects(BUCKETS.listingPhotos, listingId, cutoff)).map(
      (object) => object.path,
    );
    const photos = stale.filter((path) => PHOTO_SUFFIX.test(path));
    const referenced = await referencedBases([...new Set(photos.map(basePath))]);
    // Files without a photo suffix can never be referenced, so they go too.
    const orphans = stale.filter(
      (path) => !PHOTO_SUFFIX.test(path) || !referenced.has(basePath(path)),
    );
    await removeObjects(BUCKETS.listingPhotos, orphans);
    removed += orphans.length;
  }
  return removed;
}

// System operation run by the cron route, which authenticates by shared secret.
export async function sweepStaleStorage(
  options: { now?: Date; scope?: CleanupScope } = {},
): Promise<CleanupResult> {
  const cutoff = new Date((options.now ?? new Date()).getTime() - STALE_AFTER_MS);
  const userIds = options.scope?.userIds ?? (await listFolders(BUCKETS.uploads, UPLOADS_ROOT));
  const listingIds = options.scope?.listingIds ?? (await listFolders(BUCKETS.listingPhotos, ''));
  return {
    uploadsRemoved: await sweepUploads(userIds, cutoff),
    photosRemoved: await sweepPhotos(listingIds, cutoff),
  };
}
