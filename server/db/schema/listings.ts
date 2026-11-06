import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, geographyPoint, tsvector, updatedAt } from './columns';
import { genderPreference, listingStatus, listingType, reviewStatus, roomType } from './enums';
import { schools } from './schools';
import { users } from './users';

export const listings = pgTable(
  'listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id')
      .notNull()
      .references(() => schools.id),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: listingType('type').notNull(),
    roomType: roomType('room_type').notNull().default('single'),
    roomFeatures: text('room_features')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    title: text('title').notNull(),
    description: text('description').notNull(),
    rentCents: integer('rent_cents').notNull(),
    availableFrom: date('available_from', { mode: 'string' }).notNull(),
    availableTo: date('available_to', { mode: 'string' }).notNull(),
    bedrooms: smallint('bedrooms').notNull(),
    bathrooms: numeric('bathrooms', { precision: 3, scale: 1, mode: 'number' }).notNull(),
    roommatesCount: smallint('roommates_count').notNull().default(0),
    privateBathroom: boolean('private_bathroom'),
    genderPreference: genderPreference('gender_preference').notNull().default('any'),
    address: text('address').notNull(),
    city: text('city').notNull(),
    state: text('state').notNull(),
    zip: text('zip').notNull(),
    unit: text('unit'),
    location: geographyPoint('location').notNull(),
    furnished: boolean('furnished').notNull().default(false),
    amenities: text('amenities')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce("title", '')), 'A') || setweight(to_tsvector('english', coalesce("description", '')), 'B') || setweight(to_tsvector('english', coalesce("address", '')), 'C')`,
    ),
    status: listingStatus('status').notNull().default('active'),
    takenAt: timestamp('taken_at', { withTimezone: true }),
    reviewStatus: reviewStatus('review_status').notNull().default('pending'),
    reviewNote: text('review_note'),
    reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    updatedAt: updatedAt(),
    createdAt: createdAt(),
  },
  (t) => [
    index('listings_location_gist').using('gist', t.location),
    index('listings_search_gin').using('gin', t.searchVector),
    index('listings_browse_rent').on(t.schoolId, t.status, t.reviewStatus, t.rentCents),
    index('listings_browse_available').on(t.schoolId, t.status, t.reviewStatus, t.availableFrom),
    index('listings_owner').on(t.ownerId),
    index('listings_review_queue').on(t.reviewStatus, t.createdAt),
    check('listings_rent_range', sql`${t.rentCents} between 100 and 1000000`),
    check('listings_dates_order', sql`${t.availableTo} > ${t.availableFrom}`),
    check('listings_bedrooms_nonnegative', sql`${t.bedrooms} >= 0`),
    check('listings_roommates_range', sql`${t.roommatesCount} between 0 and 10`),
    check(
      'listings_rejection_has_note',
      sql`${t.reviewStatus} <> 'rejected' or ${t.reviewNote} is not null`,
    ),
  ],
).enableRLS();

export const listingPhotos = pgTable(
  'listing_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    storagePath: text('storage_path').notNull(),
    position: smallint('position').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('listing_photos_listing_position').on(t.listingId, t.position),
    check('listing_photos_position_range', sql`${t.position} between 0 and 9`),
  ],
).enableRLS();

export const favorites = pgTable(
  'favorites',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.listingId] }),
    index('favorites_listing').on(t.listingId),
  ],
).enableRLS();
