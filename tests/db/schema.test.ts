import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, rootDb } from '@/server/db/client';
import { blocks, listings, messages, conversations, reports, roomType } from '@/server/db/schema';
import { catchDbError, withRollback } from '../helpers/db';
import {
  createSchool,
  createUser,
  insertListing,
  insertPhoto,
  listingValues,
} from '../helpers/fixtures';

const EXPECTED_TABLES = [
  'admin_audit_log',
  'blocks',
  'conversations',
  'favorites',
  'listing_photos',
  'listings',
  'messages',
  'rate_limit_counters',
  'reports',
  'schools',
  'users',
];

describe('schema', () => {
  it('creates exactly the application tables in public', async () => {
    const rows = await rootDb().execute<{ relname: string }>(sql`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' order by c.relname`);
    expect(rows.map((row) => row.relname)).toEqual(EXPECTED_TABLES);
  });

  it('generates a searchable tsvector from title, description, and address', () =>
    withRollback(async () => {
      const owner = await createUser();
      const school = await createSchool();
      await db().insert(listings).values(listingValues(owner.id, school.id));
      const matches = await db()
        .select({ id: listings.id })
        .from(listings)
        .where(sql`${listings.searchVector} @@ websearch_to_tsquery('english', 'sunny studios')`);
      expect(matches).toHaveLength(1);
    }));

  it('defaults the room type to single and the room features to empty', () =>
    withRollback(async () => {
      const owner = await createUser();
      const school = await createSchool();
      const [row] = await db()
        .insert(listings)
        .values(listingValues(owner.id, school.id))
        .returning();
      expect(row.roomType).toBe('single');
      expect(row.roomFeatures).toEqual([]);
      expect(roomType.enumValues).toEqual(['single', 'shared']);
    }));

  it('rejects availability ranges that end before they start', () =>
    withRollback(async () => {
      const owner = await createUser();
      const school = await createSchool();
      const error = await catchDbError(() =>
        db()
          .insert(listings)
          .values(
            listingValues(owner.id, school.id, {
              availableFrom: '2027-05-01',
              availableTo: '2027-04-01',
            }),
          ),
      );
      expect(error).toContain('listings_dates_order');
    }));

  it('allows one open report per reporter and target, and a new one after resolution', () =>
    withRollback(async () => {
      const reporter = await createUser();
      const report = {
        reporterId: reporter.id,
        targetType: 'user',
        targetId: 'user_x',
        reason: 'spam',
      } as const;
      await db().insert(reports).values(report);
      expect(await catchDbError(() => db().insert(reports).values(report))).toContain(
        'reports_open_unique',
      );
      await db()
        .update(reports)
        .set({ status: 'resolved' })
        .where(and(eq(reports.reporterId, reporter.id), eq(reports.targetId, 'user_x')));
      await db().insert(reports).values(report);
    }));

  it('allows one photo per position in a listing', () =>
    withRollback(async () => {
      const owner = await createUser();
      const school = await createSchool();
      const listing = await insertListing(owner.id, school.id);
      await insertPhoto(listing.id, 0);
      await insertPhoto(listing.id, 1);
      const error = await catchDbError(() => insertPhoto(listing.id, 0, `${listing.id}/dup`));
      expect(error).toContain('listing_photos_listing_position');
    }));

  it('forbids blocking yourself', () =>
    withRollback(async () => {
      const user = await createUser();
      const error = await catchDbError(() =>
        db().insert(blocks).values({ blockerId: user.id, blockedId: user.id }),
      );
      expect(error).toContain('blocks_not_self');
    }));

  it('keeps messages when the sender is deleted', () =>
    withRollback(async () => {
      const host = await createUser();
      const renter = await createUser();
      const [conversation] = await db()
        .insert(conversations)
        .values({ hostId: host.id, renterId: renter.id })
        .returning();
      await db()
        .insert(messages)
        .values({ conversationId: conversation.id, senderId: renter.id, body: 'Hi!' });
      await db().execute(sql`delete from users where id = ${renter.id}`);
      const [message] = await db()
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id));
      expect(message.senderId).toBeNull();
    }));
});
