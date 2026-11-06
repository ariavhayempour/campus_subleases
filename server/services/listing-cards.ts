import { and, eq, sql, type SQL } from 'drizzle-orm';
import type { ListingType } from '@/lib/listing-options';
import type { LngLat } from '@/lib/validation/listing';
import { favorites, listingPhotos, listings, schools } from '@/server/db/schema';
import { photoUrls } from './photos';

export type ListingCard = {
  id: string;
  schoolSlug: string;
  title: string;
  type: ListingType;
  rentCents: number;
  availableFrom: string;
  availableTo: string;
  bedrooms: number;
  bathrooms: number;
  roommatesCount: number;
  furnished: boolean;
  location: LngLat;
  distanceKm: number;
  coverThumbUrl: string | null;
  isFavorited: boolean;
  // Approved within the last week; drives the NEW tag on cards.
  isNew: boolean;
};

type CardRow = Omit<ListingCard, 'coverThumbUrl'> & { coverPath: string | null };

// The card projection is the public one: it never carries the unit or street address.
export const CARD_COLUMNS = {
  id: listings.id,
  schoolSlug: schools.slug,
  title: listings.title,
  type: listings.type,
  rentCents: listings.rentCents,
  availableFrom: listings.availableFrom,
  availableTo: listings.availableTo,
  bedrooms: listings.bedrooms,
  bathrooms: listings.bathrooms,
  roommatesCount: listings.roommatesCount,
  furnished: listings.furnished,
  location: listings.location,
  distanceKm: sql<number>`ST_Distance(${listings.location}, ${schools.campusLocation}) / 1000`,
  coverPath: listingPhotos.storagePath,
  isNew: sql<boolean>`coalesce(${listings.reviewedAt} > now() - interval '7 days', false)`,
};

// Left-join condition for the cover photo (position 0).
export const coverJoin: SQL = and(
  eq(listingPhotos.listingId, listings.id),
  eq(listingPhotos.position, 0),
) as SQL;

export function isFavoritedBy(viewerId: string | null): SQL<boolean> {
  if (!viewerId) return sql<boolean>`false`;
  return sql<boolean>`exists (
    select 1 from ${favorites}
    where ${favorites.userId} = ${viewerId} and ${favorites.listingId} = ${listings.id}
  )`;
}

// Copies fields explicitly so extra selected columns (e.g. a window count) never leak into cards.
export function toListingCard(row: CardRow): ListingCard {
  return {
    id: row.id,
    schoolSlug: row.schoolSlug,
    title: row.title,
    type: row.type,
    rentCents: row.rentCents,
    availableFrom: row.availableFrom,
    availableTo: row.availableTo,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    roommatesCount: row.roommatesCount,
    furnished: row.furnished,
    location: row.location,
    distanceKm: row.distanceKm,
    coverThumbUrl: row.coverPath ? photoUrls(row.coverPath).thumb : null,
    isFavorited: row.isFavorited,
    isNew: row.isNew,
  };
}
