import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { PhotoContentType } from '@/lib/listing-options';
import { photoUploadRequestSchema } from '@/lib/validation/listing';
import {
  BUCKETS,
  createSignedUploadUrl,
  downloadObject,
  listObjects,
  objectExists,
  publicObjectUrl,
  removeObjects,
  uploadObject,
} from '@/server/storage/client';
import { requireUser, type Actor } from './actor';
import { parseInput, RateLimited, ValidationError } from './errors';

export const PHOTO_UPLOADS_PER_HOUR = 20;

export type PhotoUploadTarget = { path: string; signedUrl: string };
export type PhotoUrls = { thumb: string; gallery: string };

const EXTENSIONS: Record<PhotoContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const HOUR_MS = 60 * 60 * 1000;
// Guards against decompression bombs: a tiny file can declare an enormous canvas.
export const MAX_PHOTO_PIXELS = 40_000_000;

export const invalidPhoto = (message: string): ValidationError =>
  new ValidationError({ photos: [message] });

export async function requestPhotoUploads(
  actor: Actor,
  input: unknown,
): Promise<PhotoUploadTarget[]> {
  const user = requireUser(actor);
  const { files } = parseInput(photoUploadRequestSchema, input);
  const prefix = `listings/${user.userId}`;
  const since = Date.now() - HOUR_MS;
  const recent = (await listObjects(BUCKETS.uploads, prefix)).filter(
    (object) => object.createdAt.getTime() > since,
  ).length;
  if (recent + files.length > PHOTO_UPLOADS_PER_HOUR) {
    throw new RateLimited('Too many photo uploads — try again in an hour');
  }
  return Promise.all(
    files.map(async (file) => {
      const path = `${prefix}/${randomUUID()}.${EXTENSIONS[file.contentType]}`;
      return { path, signedUrl: await createSignedUploadUrl(BUCKETS.uploads, path) };
    }),
  );
}

async function loadUpload(path: string): Promise<Buffer> {
  if (!(await objectExists(BUCKETS.uploads, path))) {
    throw invalidPhoto('A photo upload is missing — add it again');
  }
  const buffer = await downloadObject(BUCKETS.uploads, path);
  // metadata() reads only the header; a pixel limit here would mislabel big photos as bad formats.
  const metadata = await sharp(buffer, { limitInputPixels: false })
    .metadata()
    .catch(() => undefined);
  if (!metadata?.format || !ACCEPTED_FORMATS.has(metadata.format)) {
    throw invalidPhoto('Use JPEG, PNG, or WebP photos');
  }
  if ((metadata.width ?? 0) * (metadata.height ?? 0) > MAX_PHOTO_PIXELS) {
    throw invalidPhoto('Photos must be under 40 megapixels');
  }
  return buffer;
}

// sharp drops all metadata (EXIF, GPS) unless asked to keep it; rotate() applies orientation first.
async function writeDisplaySizes(listingId: string, source: Buffer): Promise<string> {
  const base = `${listingId}/${randomUUID()}`;
  const oriented = sharp(source, { limitInputPixels: MAX_PHOTO_PIXELS }).rotate();
  const [thumb, gallery] = await Promise.all([
    oriented
      .clone()
      .resize({ width: 640, height: 480, fit: 'cover' })
      .webp({ quality: 78 })
      .toBuffer(),
    oriented
      .clone()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer(),
  ]);
  await uploadObject(BUCKETS.listingPhotos, `${base}-thumb.webp`, thumb, 'image/webp');
  await uploadObject(BUCKETS.listingPhotos, `${base}-gallery.webp`, gallery, 'image/webp');
  return base;
}

export async function processListingUploads(
  userId: string,
  listingId: string,
  paths: string[],
): Promise<string[]> {
  if (paths.some((path) => !path.startsWith(`listings/${userId}/`))) {
    throw invalidPhoto('A photo upload is invalid — remove it and try again');
  }
  const sources = await Promise.all(paths.map(loadUpload));
  const basePaths: string[] = [];
  try {
    for (const source of sources) basePaths.push(await writeDisplaySizes(listingId, source));
  } catch (error) {
    await deleteProcessedPhotos(basePaths);
    throw error;
  }
  return basePaths;
}

export async function deleteProcessedPhotos(basePaths: string[]): Promise<void> {
  await removeObjects(
    BUCKETS.listingPhotos,
    basePaths.flatMap((base) => [`${base}-thumb.webp`, `${base}-gallery.webp`]),
  );
}

export async function deleteUploads(paths: string[]): Promise<void> {
  await removeObjects(BUCKETS.uploads, paths);
}

export function photoUrls(basePath: string): PhotoUrls {
  return {
    thumb: publicObjectUrl(BUCKETS.listingPhotos, `${basePath}-thumb.webp`),
    gallery: publicObjectUrl(BUCKETS.listingPhotos, `${basePath}-gallery.webp`),
  };
}
