import { sql } from 'drizzle-orm';
import { customType, timestamp } from 'drizzle-orm/pg-core';
import { parseEwkbPoint, type LngLat } from '../geography';

export const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const geographyPoint = customType<{ data: LngLat; driverData: string }>({
  dataType() {
    return 'geography(Point, 4326)';
  },
  toDriver(value) {
    return sql`ST_SetSRID(ST_MakePoint(${value.lng}, ${value.lat}), 4326)::geography`;
  },
  fromDriver(value) {
    return parseEwkbPoint(value);
  },
});

export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});
