import { and, arrayContains, asc, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { MAX_BEDROOM_OPTION, MAX_MAP_PINS } from '@/lib/search-options';
import type { LngLat } from '@/lib/validation/listing';
import { effectiveSort, searchRequestSchema, type SearchFilters } from '@/lib/validation/search';
import { db } from '@/server/db/client';
import { listingPhotos, listings, schools, users } from '@/server/db/schema';
import type { Actor } from './actor';
import { parseInput } from './errors';
import {
  CARD_COLUMNS,
  coverJoin,
  isFavoritedBy,
  toListingCard,
  type ListingCard,
} from './listing-cards';
import { isPublicListing, noBlockWith } from './listing-sql';
import { photoUrls } from './photos';
import { consume, RATE_LIMITS, rateLimitSubject } from './rate-limit';

export type SearchPage = { cards: ListingCard[]; total: number; nextOffset: number | null };
export type MapPin = {
  id: string;
  location: LngLat;
  rentCents: number;
  title: string;
  coverThumbUrl: string | null;
};

const viewerOf = (actor: Actor): string | null => (actor.kind === 'user' ? actor.userId : null);

const tsQuery = (q: string): SQL => sql`websearch_to_tsquery('english', ${q})`;

const distance = sql`ST_Distance(${listings.location}, ${schools.campusLocation})`;

function filterConditions(filters: SearchFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.q) conditions.push(sql`${listings.searchVector} @@ ${tsQuery(filters.q)}`);
  if (filters.rentMin !== undefined)
    conditions.push(gte(listings.rentCents, filters.rentMin * 100));
  if (filters.rentMax !== undefined)
    conditions.push(lte(listings.rentCents, filters.rentMax * 100));
  // Inclusive overlap of [available_from, available_to] with the requested range.
  if (filters.from) conditions.push(gte(listings.availableTo, filters.from));
  if (filters.to) conditions.push(lte(listings.availableFrom, filters.to));
  if (filters.bedrooms !== undefined) {
    conditions.push(
      filters.bedrooms >= MAX_BEDROOM_OPTION
        ? gte(listings.bedrooms, MAX_BEDROOM_OPTION)
        : eq(listings.bedrooms, filters.bedrooms),
    );
  }
  // Leftover legacy 'room' rows read as apartments until a contract migration removes the value.
  if (filters.type) {
    conditions.push(
      filters.type === 'apartment'
        ? inArray(listings.type, ['apartment', 'room'])
        : eq(listings.type, filters.type),
    );
  }
  if (filters.furnished) conditions.push(eq(listings.furnished, true));
  // A whole place with nobody else living there has its own bathroom.
  if (filters.privateBathroom) {
    conditions.push(sql`(${listings.privateBathroom} or ${listings.roommatesCount} = 0)`);
  }
  if (filters.maxRoommates !== undefined) {
    conditions.push(lte(listings.roommatesCount, filters.maxRoommates));
  }
  if (filters.gender) conditions.push(inArray(listings.genderPreference, [filters.gender, 'any']));
  if (filters.amenities) conditions.push(arrayContains(listings.amenities, filters.amenities));
  if (filters.maxKm !== undefined) {
    conditions.push(
      sql`ST_DWithin(${listings.location}, ${schools.campusLocation}, ${filters.maxKm * 1000}::float8)`,
    );
  }
  if (filters.bounds) {
    const { west, south, east, north } = filters.bounds;
    conditions.push(
      sql`${listings.location}::geometry && ST_MakeEnvelope(${west}::float8, ${south}::float8, ${east}::float8, ${north}::float8, 4326)`,
    );
  }
  return conditions;
}

function whereClause(actor: Actor, schoolId: string, filters: SearchFilters): SQL | undefined {
  const viewer = viewerOf(actor);
  return and(
    eq(listings.schoolId, schoolId),
    isPublicListing,
    ...(viewer ? [noBlockWith(viewer)] : []),
    ...filterConditions(filters),
  );
}

function orderBy(filters: SearchFilters): SQL[] {
  const tiebreak = [desc(listings.createdAt), asc(listings.id)];
  switch (effectiveSort(filters)) {
    case 'rent_asc':
      return [asc(listings.rentCents), ...tiebreak];
    case 'rent_desc':
      return [desc(listings.rentCents), ...tiebreak];
    case 'distance':
      return [asc(distance), ...tiebreak];
    case 'relevance':
      return [
        desc(sql`ts_rank(${listings.searchVector}, ${tsQuery(filters.q ?? '')})`),
        ...tiebreak,
      ];
    case 'newest':
      return tiebreak;
  }
}

type SearchInput = { schoolId: string; filters: SearchFilters; offset?: number; limit?: number };

// Only the client-driven next-page path is limited; the server-rendered first page is not.
export async function loadMoreListings(actor: Actor, input: SearchInput): Promise<SearchPage> {
  const parsed = parseInput(searchRequestSchema, input);
  const rule = actor.kind === 'user' ? RATE_LIMITS.loadMore : RATE_LIMITS.loadMoreSignedOut;
  await consume(rule, rateLimitSubject(actor));
  return searchListings(actor, parsed);
}

export async function searchListings(actor: Actor, input: SearchInput): Promise<SearchPage> {
  const { schoolId, filters, offset, limit } = parseInput(searchRequestSchema, input);
  const rows = await db()
    .select({
      ...CARD_COLUMNS,
      isFavorited: isFavoritedBy(viewerOf(actor)),
      total: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(listings)
    .innerJoin(schools, eq(schools.id, listings.schoolId))
    .innerJoin(users, eq(users.id, listings.ownerId))
    .leftJoin(listingPhotos, coverJoin)
    .where(whereClause(actor, schoolId, filters))
    .orderBy(...orderBy(filters))
    .limit(limit)
    .offset(offset);
  const total = rows[0]?.total ?? 0;
  const end = offset + rows.length;
  return {
    cards: rows.map(toListingCard),
    total,
    nextOffset: end < total ? end : null,
  };
}

export async function searchMapPins(
  actor: Actor,
  input: { schoolId: string; filters: SearchFilters },
): Promise<MapPin[]> {
  const { schoolId, filters } = parseInput(searchRequestSchema, input);
  const rows = await db()
    .select({
      id: listings.id,
      location: listings.location,
      rentCents: listings.rentCents,
      title: listings.title,
      coverPath: listingPhotos.storagePath,
    })
    .from(listings)
    .innerJoin(schools, eq(schools.id, listings.schoolId))
    .innerJoin(users, eq(users.id, listings.ownerId))
    .leftJoin(listingPhotos, coverJoin)
    .where(whereClause(actor, schoolId, filters))
    .orderBy(desc(listings.createdAt), asc(listings.id))
    .limit(MAX_MAP_PINS);
  return rows.map(({ coverPath, ...pin }) => ({
    ...pin,
    coverThumbUrl: coverPath ? photoUrls(coverPath).thumb : null,
  }));
}
