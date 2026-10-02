import { and, asc, count, desc, eq, or, sql } from 'drizzle-orm';
import {
  isAmenity,
  MAX_ACTIVE_LISTINGS,
  type Amenity,
  type ListingStatus,
  type ReviewStatus,
} from '@/lib/listing-options';
import { isUuid, type ListingInput, type LngLat } from '@/lib/validation/listing';
import { db } from '@/server/db/client';
import { blocks, conversations, listingPhotos, listings, schools, users } from '@/server/db/schema';
import { requireUser, type Actor } from './actor';
import { NotFound } from './errors';
import { isFavoritedBy } from './listing-cards';
import { countsTowardCap, isExpired, isPublicListing } from './listing-sql';
import { photoUrls } from './photos';

type ListingRow = typeof listings.$inferSelect;

export type ListingPhotoView = { id: string; thumbUrl: string; galleryUrl: string };

export type ListingDetail = Omit<
  ListingRow,
  'ownerId' | 'schoolId' | 'searchVector' | 'reviewedBy' | 'reviewedAt' | 'amenities'
> & {
  amenities: Amenity[];
  isPublic: boolean;
  isExpired: boolean;
  school: { slug: string; name: string; campusLocation: LngLat };
  host: { displayName: string; joinedAt: Date };
  distanceKm: number;
  photos: ListingPhotoView[];
  viewer: 'owner' | 'admin' | 'visitor';
  isFavorited: boolean;
};

export type MyListing = {
  id: string;
  title: string;
  schoolSlug: string;
  rentCents: number;
  availableFrom: string;
  availableTo: string;
  status: ListingStatus;
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
  isExpired: boolean;
  coverThumbUrl: string | null;
};

export type ListingEditData = {
  id: string;
  schoolSlug: string;
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
  values: ListingInput;
  photos: { id: string; thumbUrl: string }[];
};

export type SchoolOption = {
  id: string;
  slug: string;
  name: string;
  campusLocation: LngLat;
  warnRadiusKm: number;
};

const notFound = (): NotFound => new NotFound('Listing not found');

async function loadPhotos(listingId: string): Promise<ListingPhotoView[]> {
  const rows = await db()
    .select({ id: listingPhotos.id, storagePath: listingPhotos.storagePath })
    .from(listingPhotos)
    .where(eq(listingPhotos.listingId, listingId))
    .orderBy(asc(listingPhotos.position));
  return rows.map((row) => {
    const urls = photoUrls(row.storagePath);
    return { id: row.id, thumbUrl: urls.thumb, galleryUrl: urls.gallery };
  });
}

async function blockedBetween(a: string, b: string): Promise<boolean> {
  const rows = await db()
    .select({ blockerId: blocks.blockerId })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)),
        and(eq(blocks.blockerId, b), eq(blocks.blockedId, a)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function hasConversation(listingId: string, renterId: string): Promise<boolean> {
  const rows = await db()
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.listingId, listingId), eq(conversations.renterId, renterId)))
    .limit(1);
  return rows.length > 0;
}

export async function getListingDetail(actor: Actor, listingId: string): Promise<ListingDetail> {
  if (!isUuid(listingId)) throw notFound();
  const viewerId = actor.kind === 'user' ? actor.userId : null;
  const [row] = await db()
    .select({
      listing: listings,
      schoolSlug: schools.slug,
      schoolName: schools.name,
      campusLocation: schools.campusLocation,
      hostName: users.displayName,
      hostJoinedAt: users.createdAt,
      distanceKm: sql<number>`ST_Distance(${listings.location}, ${schools.campusLocation}) / 1000`,
      isPublic: sql<boolean>`${isPublicListing}`,
      isExpired,
      isFavorited: isFavoritedBy(viewerId),
    })
    .from(listings)
    .innerJoin(schools, eq(schools.id, listings.schoolId))
    .innerJoin(users, eq(users.id, listings.ownerId))
    .where(eq(listings.id, listingId));
  if (!row) throw notFound();

  const { listing } = row;
  const viewer =
    viewerId === listing.ownerId
      ? 'owner'
      : actor.kind === 'user' && actor.isAdmin
        ? 'admin'
        : 'visitor';
  if (viewer === 'visitor') {
    if (!row.isPublic) throw notFound();
    if (viewerId && (await blockedBetween(viewerId, listing.ownerId))) throw notFound();
  }
  const showUnit =
    viewer !== 'visitor' || (viewerId !== null && (await hasConversation(listing.id, viewerId)));

  return {
    id: listing.id,
    type: listing.type,
    title: listing.title,
    description: listing.description,
    rentCents: listing.rentCents,
    availableFrom: listing.availableFrom,
    availableTo: listing.availableTo,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    roommatesCount: listing.roommatesCount,
    privateBathroom: listing.privateBathroom,
    genderPreference: listing.genderPreference,
    address: listing.address,
    city: listing.city,
    state: listing.state,
    zip: listing.zip,
    location: listing.location,
    furnished: listing.furnished,
    status: listing.status,
    takenAt: listing.takenAt,
    reviewStatus: listing.reviewStatus,
    reviewNote: listing.reviewNote,
    updatedAt: listing.updatedAt,
    createdAt: listing.createdAt,
    unit: showUnit ? listing.unit : null,
    amenities: listing.amenities.filter(isAmenity),
    isPublic: row.isPublic,
    isExpired: row.isExpired,
    school: { slug: row.schoolSlug, name: row.schoolName, campusLocation: row.campusLocation },
    host: { displayName: row.hostName, joinedAt: row.hostJoinedAt },
    distanceKm: row.distanceKm,
    photos: await loadPhotos(listing.id),
    viewer,
    isFavorited: row.isFavorited,
  };
}

export async function listMyListings(actor: Actor): Promise<MyListing[]> {
  const user = requireUser(actor);
  const rows = await db()
    .select({
      id: listings.id,
      title: listings.title,
      schoolSlug: schools.slug,
      rentCents: listings.rentCents,
      availableFrom: listings.availableFrom,
      availableTo: listings.availableTo,
      status: listings.status,
      reviewStatus: listings.reviewStatus,
      reviewNote: listings.reviewNote,
      isExpired,
      coverPath: listingPhotos.storagePath,
    })
    .from(listings)
    .innerJoin(schools, eq(schools.id, listings.schoolId))
    .leftJoin(
      listingPhotos,
      and(eq(listingPhotos.listingId, listings.id), eq(listingPhotos.position, 0)),
    )
    .where(eq(listings.ownerId, user.userId))
    .orderBy(desc(listings.createdAt));
  return rows.map(({ coverPath, ...row }) => ({
    ...row,
    coverThumbUrl: coverPath ? photoUrls(coverPath).thumb : null,
  }));
}

export async function getListingForEdit(actor: Actor, listingId: string): Promise<ListingEditData> {
  const user = requireUser(actor);
  if (!isUuid(listingId)) throw notFound();
  const [row] = await db()
    .select({ listing: listings, schoolSlug: schools.slug })
    .from(listings)
    .innerJoin(schools, eq(schools.id, listings.schoolId))
    .where(and(eq(listings.id, listingId), eq(listings.ownerId, user.userId)));
  if (!row) throw notFound();
  const { listing } = row;
  const photos = await loadPhotos(listing.id);
  return {
    id: listing.id,
    schoolSlug: row.schoolSlug,
    reviewStatus: listing.reviewStatus,
    reviewNote: listing.reviewNote,
    photos: photos.map((photo) => ({ id: photo.id, thumbUrl: photo.thumbUrl })),
    values: {
      schoolId: listing.schoolId,
      type: listing.type,
      title: listing.title,
      description: listing.description,
      rentDollars: listing.rentCents / 100,
      availableFrom: listing.availableFrom,
      availableTo: listing.availableTo,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      roommatesCount: listing.roommatesCount,
      privateBathroom: listing.privateBathroom,
      genderPreference: listing.genderPreference,
      address: listing.address,
      unit: listing.unit ?? '',
      city: listing.city,
      state: listing.state,
      zip: listing.zip,
      location: listing.location,
      furnished: listing.furnished,
      amenities: listing.amenities.filter(isAmenity),
      photos: photos.map((photo) => ({ kind: 'existing', id: photo.id })),
    },
  };
}

export async function getListingFormContext(
  actor: Actor,
): Promise<{ schools: SchoolOption[]; homeSchoolId: string | null; atCap: boolean }> {
  const user = requireUser(actor);
  const [schoolRows, [me], [counted]] = await Promise.all([
    db()
      .select({
        id: schools.id,
        slug: schools.slug,
        name: schools.name,
        campusLocation: schools.campusLocation,
        warnRadiusKm: schools.warnRadiusKm,
      })
      .from(schools)
      .where(eq(schools.isActive, true))
      .orderBy(asc(schools.name)),
    db().select({ homeSchoolId: users.homeSchoolId }).from(users).where(eq(users.id, user.userId)),
    db()
      .select({ n: count() })
      .from(listings)
      .innerJoin(schools, eq(schools.id, listings.schoolId))
      .where(and(eq(listings.ownerId, user.userId), countsTowardCap)),
  ]);
  return {
    schools: schoolRows,
    homeSchoolId: me?.homeSchoolId ?? null,
    atCap: counted.n >= MAX_ACTIVE_LISTINGS,
  };
}
