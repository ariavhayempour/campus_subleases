import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './columns';
import { userStatus } from './enums';
import { schools } from './schools';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  // Derived from the names on every Clerk sync; see lib/display-name.ts.
  displayName: text('display_name').notNull(),
  homeSchoolId: uuid('home_school_id').references(() => schools.id),
  status: userStatus('status').notNull().default('active'),
  updatedAt: updatedAt(),
  createdAt: createdAt(),
}).enableRLS();
