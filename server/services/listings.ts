import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, gt, sql } from 'drizzle-orm';
import { MAX_ACTIVE_LISTINGS, type ReviewStatus } from '@/lib/listing-options';
import {
  isSharedSpace,
  nextReviewStatus,
  reviewedFieldsChanged,
  type ReviewedFields,
} from '@/lib/listing-rules';
import {
  isUuid,
  listingInputSchema,
  listingStatusInputSchema,
  type ListingData,
  type PhotoRef,
} from '@/lib/validation/listing';
import { db, type DbExecutor } from '@/server/db/client';
import { listingPhotos, listings, schools } from '@/server/db/schema';
import { requireUser, type Actor } from './actor';
import { bestEffort } from './best-effort';
import {
  Conflict,
  ListingCapReached,
  NotFound,
  parseInput,
  RateLimited,
  ValidationError,
} from './errors';
import { countsTowardCap, schoolToday } from './listing-sql';
import {
  deleteProcessedPhotos,
  deleteUploads,
  invalidPhoto,
  processListingUploads,
} from './photos';

export const LISTINGS_PER_DAY = 5;

function toColumns(data: ListingData): Omit<typeof listings.$inferInsert, 'ownerId'> {
  const shared = isSharedSpace(data.type, data.roommatesCount);
  return {
    schoolId: data.schoolId,
    type: data.type,
    title: data.title,
    description: data.description,
    rentCents: data.rentDollars * 100,
    availableFrom: data.availableFrom,
    availableTo: data.availableTo,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    roommatesCount: data.roommatesCount,
    privateBathroom: data.type === 'room' ? data.privateBathroom : null,
    genderPreference: shared ? data.genderPreference : ('any' as const),
    address: data.address,
    unit: data.unit || null,
    city: data.city,
    state: data.state,
    zip: data.zip,
    location: data.location,
    furnished: data.furnished,
    amenities: [...new Set(data.amenities)],
  };
}

// Upload refs only; callers compare lengths to detect non-upload refs.
function uploadPathsOf(photos: PhotoRef[]): string[] {
  return photos.flatMap((photo) => (photo.kind === 'upload' ? [photo.path] : []));
}

async function loadSchool(
  executor: DbExecutor,
  schoolId: string,
): Promise<{ slug: string; today: string }> {
  const [school] = await executor
    .select({ slug: schools.slug, today: sql<string>`${schoolToday}::text` })
    .from(schools)
    .where(and(eq(schools.id, schoolId), eq(schools.isActive, true)));
  if (!school) throw new ValidationError({ schoolId: ['Choose a school'] });
  return school;
}

function assertNotPast(availableTo: string, today: string): void {
  if (availableTo < today) {
    throw new ValidationError({ availableTo: ['The end date has already passed'] });
  }
}

// Serializes cap and rate-limit checks per owner so concurrent saves cannot both pass.
async function lockOwner(executor: DbExecutor, ownerId: string): Promise<void> {
  await executor.execute(sql`select pg_advisory_xact_lock(hashtext(${ownerId}))`);
}

async function countTowardCap(executor: DbExecutor, ownerId: string): Promise<number> {
  const [row] = await executor
    .select({ n: count() })
    .from(listings)
    .innerJoin(schools, eq(schools.id, listings.schoolId))
    .where(and(eq(listings.ownerId, ownerId), countsTowardCap));
  return row.n;
}

async function countRecentListings(executor: DbExecutor, ownerId: string): Promise<number> {
  const [row] = await executor
    .select({ n: count() })
    .from(listings)
    .where(
      and(eq(listings.ownerId, ownerId), gt(listings.createdAt, sql`now() - interval '24 hours'`)),
    );
  return row.n;
}

const rateLimited = (): RateLimited =>
  new RateLimited('You can post up to 5 listings a day — try again tomorrow');

export async function createListing(
  actor: Actor,
  input: unknown,
): Promise<{ id: string; schoolSlug: string }> {
  const user = requireUser(actor);
  const data = parseInput(listingInputSchema, input);
  const uploadPaths = uploadPathsOf(data.photos);
  if (uploadPaths.length !== data.photos.length) {
    throw invalidPhoto('A photo upload is invalid — remove it and try again');
  }
  const existingIds = data.photos.flatMap((photo) => (photo.kind === 'existing' ? [photo.id] : []));
  if (new Set(existingIds).size !== existingIds.length) {
    throw invalidPhoto('A photo upload is invalid — remove it and try again');
  }

  const school = await loadSchool(db(), data.schoolId);
  assertNotPast(data.availableTo, school.today);
  // Cheap pre-checks so a doomed save never pays for photo processing; both re-run under the lock.
  if ((await countTowardCap(db(), user.userId)) >= MAX_ACTIVE_LISTINGS) {
    throw new ListingCapReached();
  }
  if ((await countRecentListings(db(), user.userId)) >= LISTINGS_PER_DAY) throw rateLimited();

  const id = randomUUID();
  const basePaths = await processListingUploads(user.userId, id, uploadPaths);
  try {
    await db().transaction(async (tx) => {
      await lockOwner(tx, user.userId);
      if ((await countRecentListings(tx, user.userId)) >= LISTINGS_PER_DAY) throw rateLimited();
      await tx.insert(listings).values({ id, ownerId: user.userId, ...toColumns(data) });
      await tx
        .insert(listingPhotos)
        .values(
          basePaths.map((storagePath, position) => ({ listingId: id, storagePath, position })),
        );
      if ((await countTowardCap(tx, user.userId)) > MAX_ACTIVE_LISTINGS) {
        throw new ListingCapReached();
      }
    });
  } catch (error) {
    await bestEffort(() => deleteProcessedPhotos(basePaths));
    throw error;
  }
  await bestEffort(() => deleteUploads(uploadPaths));
  return { id, schoolSlug: school.slug };
}

type ListingRow = typeof listings.$inferSelect;

const FIXED_FIELD_MESSAGE = "This can't be changed — delete the listing and post a new one";

// Mirrors the countsTowardCap SQL predicate for a single row.
function countsTowardCapNow(
  status: ListingRow['status'],
  reviewStatus: ReviewStatus,
  availableTo: string,
  today: string,
): boolean {
  return (
    status === 'active' &&
    (reviewStatus === 'pending' || reviewStatus === 'approved' || reviewStatus === 'hidden') &&
    availableTo >= today
  );
}

const photoKey = (photo: PhotoRef): string =>
  photo.kind === 'existing' ? photo.id : `upload:${photo.path}`;

type ReviewedColumns = Pick<
  ListingRow,
  | 'title'
  | 'description'
  | 'rentCents'
  | 'genderPreference'
  | 'address'
  | 'city'
  | 'state'
  | 'zip'
  | 'unit'
  | 'location'
>;

function reviewedFields(row: ReviewedColumns, photoKeys: string[]): ReviewedFields {
  return {
    title: row.title,
    description: row.description,
    rentCents: row.rentCents,
    genderPreference: row.genderPreference,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    // Forms send a blank unit as '' while the column stores null.
    unit: row.unit || null,
    location: row.location,
    photoKeys,
  };
}

async function loadOwnedListing(ownerId: string, listingId: string): Promise<ListingRow> {
  if (!isUuid(listingId)) throw new NotFound('Listing not found');
  const [row] = await db()
    .select()
    .from(listings)
    .where(and(eq(listings.id, listingId), eq(listings.ownerId, ownerId)));
  if (!row) throw new NotFound('Listing not found');
  return row;
}

export async function updateListing(
  actor: Actor,
  listingId: string,
  input: unknown,
): Promise<{ id: string; schoolSlug: string; reviewStatus: ReviewStatus }> {
  const user = requireUser(actor);
  const current = await loadOwnedListing(user.userId, listingId);
  const data = parseInput(listingInputSchema, input);
  const fixedFieldErrors: Record<string, string[]> = {};
  if (data.schoolId !== current.schoolId) fixedFieldErrors.schoolId = [FIXED_FIELD_MESSAGE];
  if (data.type !== current.type) fixedFieldErrors.type = [FIXED_FIELD_MESSAGE];
  if (Object.keys(fixedFieldErrors).length > 0) throw new ValidationError(fixedFieldErrors);

  const currentPhotos = await db()
    .select()
    .from(listingPhotos)
    .where(eq(listingPhotos.listingId, listingId))
    .orderBy(asc(listingPhotos.position));
  const pathById = new Map(currentPhotos.map((photo) => [photo.id, photo.storagePath]));
  if (data.photos.some((photo) => photo.kind === 'existing' && !pathById.has(photo.id))) {
    throw invalidPhoto('A photo upload is invalid — remove it and try again');
  }
  const existingIds = data.photos.flatMap((photo) => (photo.kind === 'existing' ? [photo.id] : []));
  if (new Set(existingIds).size !== existingIds.length) {
    throw invalidPhoto('A photo upload is invalid — remove it and try again');
  }

  const school = await loadSchool(db(), data.schoolId);
  if (data.availableTo !== current.availableTo) assertNotPast(data.availableTo, school.today);

  const columns = toColumns(data);
  const changed = reviewedFieldsChanged(
    reviewedFields(
      current,
      currentPhotos.map((photo) => photo.id),
    ),
    reviewedFields(
      {
        ...columns,
        genderPreference: columns.genderPreference ?? 'any',
        unit: columns.unit ?? null,
      },
      data.photos.map(photoKey),
    ),
  );
  const reviewStatus = nextReviewStatus(current.reviewStatus, changed);
  const clearsNote = reviewStatus === 'pending' && current.reviewStatus !== 'pending';
  if (
    !countsTowardCapNow(current.status, current.reviewStatus, current.availableTo, school.today) &&
    countsTowardCapNow(current.status, reviewStatus, data.availableTo, school.today) &&
    (await countTowardCap(db(), user.userId)) >= MAX_ACTIVE_LISTINGS
  ) {
    throw new ListingCapReached();
  }

  const uploadPaths = uploadPathsOf(data.photos);
  const newBases = await processListingUploads(user.userId, listingId, uploadPaths);
  const orderedPaths: string[] = [];
  let nextUpload = 0;
  for (const photo of data.photos) {
    const path = photo.kind === 'existing' ? pathById.get(photo.id) : newBases[nextUpload++];
    if (!path) throw invalidPhoto('A photo upload is invalid — remove it and try again');
    orderedPaths.push(path);
  }
  const keptIds = new Set(existingIds);
  const removedPaths = currentPhotos
    .filter((photo) => !keptIds.has(photo.id))
    .map((photo) => photo.storagePath);

  try {
    await db().transaction(async (tx) => {
      await lockOwner(tx, user.userId);
      // Re-read under a row lock so an admin action or another edit since the first read is not overwritten.
      const [locked] = await tx
        .select({ reviewStatus: listings.reviewStatus })
        .from(listings)
        .where(eq(listings.id, listingId))
        .for('update');
      const lockedPhotoIds = (
        await tx
          .select({ id: listingPhotos.id })
          .from(listingPhotos)
          .where(eq(listingPhotos.listingId, listingId))
      ).map((photo) => photo.id);
      if (
        !locked ||
        locked.reviewStatus !== current.reviewStatus ||
        lockedPhotoIds.length !== currentPhotos.length ||
        lockedPhotoIds.some((id) => !pathById.has(id))
      ) {
        throw new Conflict();
      }
      await tx
        .update(listings)
        .set({ ...columns, reviewStatus, ...(clearsNote ? { reviewNote: null } : {}) })
        .where(eq(listings.id, listingId));
      await tx.delete(listingPhotos).where(eq(listingPhotos.listingId, listingId));
      await tx
        .insert(listingPhotos)
        .values(
          orderedPaths.map((storagePath, position) => ({ listingId, storagePath, position })),
        );
      if ((await countTowardCap(tx, user.userId)) > MAX_ACTIVE_LISTINGS) {
        throw new ListingCapReached();
      }
    });
  } catch (error) {
    await bestEffort(() => deleteProcessedPhotos(newBases));
    throw error;
  }
  await bestEffort(() => deleteProcessedPhotos(removedPaths));
  await bestEffort(() => deleteUploads(uploadPaths));
  return { id: listingId, schoolSlug: school.slug, reviewStatus };
}

export async function setListingStatus(actor: Actor, input: unknown): Promise<void> {
  const user = requireUser(actor);
  const { listingId, status } = parseInput(listingStatusInputSchema, input);
  await db().transaction(async (tx) => {
    await lockOwner(tx, user.userId);
    const [row] = await tx
      .select({ status: listings.status })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.ownerId, user.userId)));
    if (!row) throw new NotFound('Listing not found');
    if (row.status === status) return;
    await tx
      .update(listings)
      .set({ status, takenAt: status === 'taken' ? new Date() : null })
      .where(eq(listings.id, listingId));
    if ((await countTowardCap(tx, user.userId)) > MAX_ACTIVE_LISTINGS) {
      throw new ListingCapReached();
    }
  });
}

export async function deleteListing(actor: Actor, listingId: string): Promise<void> {
  const user = requireUser(actor);
  await loadOwnedListing(user.userId, listingId);
  const photoPaths = await db().transaction(async (tx) => {
    const photos = await tx
      .select({ storagePath: listingPhotos.storagePath })
      .from(listingPhotos)
      .where(eq(listingPhotos.listingId, listingId));
    await tx.delete(listings).where(eq(listings.id, listingId));
    return photos.map((photo) => photo.storagePath);
  });
  await bestEffort(() => deleteProcessedPhotos(photoPaths));
}
