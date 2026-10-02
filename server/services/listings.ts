import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/nextjs';
import { and, count, eq, gt, sql } from 'drizzle-orm';
import { MAX_ACTIVE_LISTINGS } from '@/lib/listing-options';
import { isSharedSpace } from '@/lib/listing-rules';
import { listingInputSchema, type ListingData, type PhotoRef } from '@/lib/validation/listing';
import { db, type DbExecutor } from '@/server/db/client';
import { listingPhotos, listings, schools } from '@/server/db/schema';
import { requireUser, type Actor } from './actor';
import { ListingCapReached, parseInput, RateLimited, ValidationError } from './errors';
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

// Storage cleanup must never mask the real outcome; leftovers are swept by a later job.
async function bestEffort(cleanup: () => Promise<void>): Promise<void> {
  try {
    await cleanup();
  } catch (error) {
    Sentry.captureException(error);
  }
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

  const school = await loadSchool(db(), data.schoolId);
  assertNotPast(data.availableTo, school.today);
  if ((await countTowardCap(db(), user.userId)) >= MAX_ACTIVE_LISTINGS) {
    throw new ListingCapReached();
  }

  const id = randomUUID();
  const basePaths = await processListingUploads(user.userId, id, uploadPaths);
  try {
    await db().transaction(async (tx) => {
      await lockOwner(tx, user.userId);
      const [recent] = await tx
        .select({ n: count() })
        .from(listings)
        .where(
          and(
            eq(listings.ownerId, user.userId),
            gt(listings.createdAt, sql`now() - interval '24 hours'`),
          ),
        );
      if (recent.n >= LISTINGS_PER_DAY) {
        throw new RateLimited('You can post up to 5 listings a day — try again tomorrow');
      }
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
