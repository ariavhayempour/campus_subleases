import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import {
  amenitiesFor,
  isAmenity,
  isRoomFeature,
  toListingType,
  type Amenity,
  type ListingStatus,
  type ListingType,
  type ReviewStatus,
  type RoomFeature,
} from '@/lib/listing-options';
import { listingCap } from '@/lib/listing-rules';
import { isUuid, type ListingInput, type LngLat } from '@/lib/validation/listing';
import { db } from '@/server/db/client';
import { conversations, listingPhotos, listings, schools, users } from '@/server/db/schema';
import { requireUser, type Actor } from './actor';
import { NotFound } from './errors';
import { isFavoritedBy } from './listing-cards';
import { countsTowardCap, isExpired, isPublicListing } from './listing-sql';
import { getBlockState } from './moderation';
import { photoUrls } from './photos';
import { isOutsideHomeSchool } from './school-lock';

type ListingRow = typeof listings.$inferSelect;

export type ListingPhotoView = { id: string; thumbUrl: string; galleryUrl: string };

export type ListingDetail = Omit<
  ListingRow,
  | 'ownerId'
  | 'schoolId'
  | 'searchVector'
  | 'reviewedBy'
  | 'reviewedAt'
  | 'amenities'
  | 'type'
  | 'roomFeatures'
> & {
  type: ListingType;
  amenities: Amenity[];
  roomFeatures: RoomFeature[];
  isPublic: boolean;
  isExpired: boolean;
  school: { slug: string; name: string; campusLocation: LngLat };
  host: { displayName: string; joinedAt: Date };
  distanceKm: number;
  photos: ListingPhotoView[];
  viewer: 'owner' | 'admin' | 'visitor';
  isFavorited: boolean;
  // Signed-in student from another school: may view, not interact.
  crossSchool: boolean;
  conversationId: string | null; // the viewer's conversation on this listing as renter
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

async function findRenterConversationId(
  listingId: string,
  renterId: string,
): Promise<string | null> {
  const [row] = await db()
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.listingId, listingId), eq(conversations.renterId, renterId)))
    .limit(1);
  return row?.id ?? null;
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
    if (viewerId) {
      const state = await getBlockState(viewerId, listing.ownerId);
      if (state.viewerBlocked || state.blockedByOther) throw notFound();
    }
  }
  const conversationId = viewerId ? await findRenterConversationId(listing.id, viewerId) : null;
  const showUnit = viewer !== 'visitor' || conversationId !== null;
  const crossSchool =
    viewer === 'visitor' &&
    actor.kind === 'user' &&
    (await isOutsideHomeSchool(actor, listing.schoolId));

  return {
    id: listing.id,
    type: toListingType(listing.type),
    roomType: listing.roomType,
    roomFeatures: listing.roomFeatures.filter(isRoomFeature),
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
    crossSchool,
    conversationId,
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
      type: toListingType(listing.type),
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
      roomType: listing.roomType,
      roomFeatures: listing.roomFeatures.filter(isRoomFeature),
      address: listing.address,
      unit: listing.unit ?? '',
      city: listing.city,
      state: listing.state,
      zip: listing.zip,
      location: listing.location,
      furnished: listing.furnished,
      amenities: listing.amenities
        .filter(isAmenity)
        .filter((amenity) => amenitiesFor(toListingType(listing.type)).includes(amenity)),
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
  const homeSchoolId = me?.homeSchoolId ?? null;
  return {
    // Students can post only to their home school; admins pick any.
    schools:
      user.isAdmin || !homeSchoolId ? schoolRows : schoolRows.filter((s) => s.id === homeSchoolId),
    homeSchoolId,
    atCap: counted.n >= listingCap(user.isAdmin),
  };
}
