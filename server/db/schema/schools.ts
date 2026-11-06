import { boolean, jsonb, pgTable, smallint, text, uuid } from 'drizzle-orm/pg-core';
import type { SchoolTheme } from '@/lib/school-theme';
import { createdAt, geographyPoint } from './columns';

export const schools = pgTable('schools', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  shortName: text('short_name'),
  city: text('city'),
  campusName: text('campus_name'),
  theme: jsonb('theme').$type<SchoolTheme>(),
  campusLocation: geographyPoint('campus_location').notNull(),
  defaultMapZoom: smallint('default_map_zoom').notNull(),
  timezone: text('timezone').notNull(),
  warnRadiusKm: smallint('warn_radius_km').notNull().default(25),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
}).enableRLS();
