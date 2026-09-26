import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './columns';
import { userStatus } from './enums';
import { schools } from './schools';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  displayName: text('display_name'),
  homeSchoolId: uuid('home_school_id').references(() => schools.id),
  status: userStatus('status').notNull().default('active'),
  updatedAt: updatedAt(),
  createdAt: createdAt(),
}).enableRLS();
