import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt } from './columns';
import { listings } from './listings';
import { users } from './users';

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id').references(() => listings.id, { onDelete: 'set null' }),
    hostId: text('host_id').references(() => users.id, { onDelete: 'set null' }),
    renterId: text('renter_id').references(() => users.id, { onDelete: 'set null' }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
    hostLastReadAt: timestamp('host_last_read_at', { withTimezone: true }),
    renterLastReadAt: timestamp('renter_last_read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique('conversations_listing_renter').on(t.listingId, t.renterId),
    index('conversations_host_inbox').on(t.hostId, t.lastMessageAt.desc()),
    index('conversations_renter_inbox').on(t.renterId, t.lastMessageAt.desc()),
  ],
).enableRLS();

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: text('sender_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('messages_conversation').on(t.conversationId, t.createdAt),
    index('messages_sender_rate').on(t.senderId, t.createdAt),
    check('messages_body_length', sql`char_length(${t.body}) between 1 and 2000`),
  ],
).enableRLS();

export const blocks = pgTable(
  'blocks',
  {
    blockerId: text('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: text('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    index('blocks_blocked').on(t.blockedId),
    check('blocks_not_self', sql`${t.blockerId} <> ${t.blockedId}`),
  ],
).enableRLS();
