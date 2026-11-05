import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  MAX_REPORTS_PER_DAY,
  REPORT_DUPLICATE,
  REPORT_RATE_LIMITED,
} from '@/lib/moderation-options';
import { db } from '@/server/db/client';
import { adminAuditLog, blocks, listings, reports, users } from '@/server/db/schema';
import { ANONYMOUS } from '@/server/services/actor';
import {
  Conflict,
  Forbidden,
  NotFound,
  RateLimited,
  ValidationError,
} from '@/server/services/errors';
import { createReport } from '@/server/services/reports';
import { actorFor, createUser, insertListing } from '../helpers/fixtures';
import { insertConversation, insertMessage, liveListing } from '../helpers/messaging';
import { insertReport } from '../helpers/moderation';
import { withRollback } from '../helpers/db';

const HOUR = 3_600_000;

async function fieldErrors(promise: Promise<unknown>): Promise<Record<string, string[]>> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ValidationError) return error.fieldErrors;
    throw error;
  }
  throw new Error('Expected ValidationError');
}

async function auditRows(targetId: string) {
  return db().select().from(adminAuditLog).where(eq(adminAuditLog.targetId, targetId));
}

describe('createReport', () => {
  it('creates a report on a user, a public listing, and a message', async () => {
    await withRollback(async () => {
      const { owner, listing } = await liveListing();
      const reporter = await createUser();
      const actor = actorFor(reporter.id);
      const conversation = await insertConversation({
        listingId: listing.id,
        hostId: owner.id,
        renterId: reporter.id,
      });
      const message = await insertMessage(conversation.id, owner.id, 'hello');

      const onUser = await createReport(actor, {
        targetType: 'user',
        targetId: owner.id,
        reason: 'scam',
        details: '  looks fake  ',
      });
      expect(onUser.autoHidden).toBe(false);
      const [row] = await db().select().from(reports).where(eq(reports.id, onUser.id));
      expect(row).toMatchObject({
        reporterId: reporter.id,
        targetType: 'user',
        targetId: owner.id,
        reason: 'scam',
        status: 'open',
        details: 'looks fake',
      });

      const onListing = await createReport(actor, {
        targetType: 'listing',
        targetId: listing.id,
        reason: 'spam',
        details: '',
      });
      expect(onListing.autoHidden).toBe(false);
      const [listingRow] = await db().select().from(reports).where(eq(reports.id, onListing.id));
      expect(listingRow.details).toBeNull();

      const onMessage = await createReport(actor, {
        targetType: 'message',
        targetId: message.id,
        reason: 'harassment',
      });
      expect(onMessage.autoHidden).toBe(false);
      const [messageRow] = await db().select().from(reports).where(eq(reports.id, onMessage.id));
      expect(listingRow).toMatchObject({ targetType: 'listing', targetId: listing.id });
      expect(messageRow).toMatchObject({ targetType: 'message', targetId: message.id });
    });
  });

  it('rejects a second open report, allows one after resolution', async () => {
    await withRollback(async () => {
      const { owner } = await liveListing();
      const reporter = await createUser();
      const input = { targetType: 'user', targetId: owner.id, reason: 'spam' };
      const first = await createReport(actorFor(reporter.id), input);
      await expect(createReport(actorFor(reporter.id), input)).rejects.toThrow(
        new Conflict(REPORT_DUPLICATE),
      );
      await db().update(reports).set({ status: 'resolved' }).where(eq(reports.id, first.id));
      await expect(createReport(actorFor(reporter.id), input)).resolves.toBeTruthy();
    });
  });

  it('does not reveal targets the reporter cannot see', async () => {
    await withRollback(async () => {
      const owner = await createUser();
      const reporter = await createUser();
      const { school } = await liveListing();
      const pending = await insertListing(owner.id, school.id);
      const other = await createUser();
      const conversation = await insertConversation({
        listingId: pending.id,
        hostId: owner.id,
        renterId: other.id,
      });
      const message = await insertMessage(conversation.id, owner.id, 'hi');
      const actor = actorFor(reporter.id);
      const base = { reason: 'spam' };
      await expect(
        createReport(actor, { ...base, targetType: 'listing', targetId: pending.id }),
      ).rejects.toBeInstanceOf(NotFound);
      await expect(
        createReport(actor, { ...base, targetType: 'listing', targetId: 'nope' }),
      ).rejects.toBeInstanceOf(NotFound);
      await expect(
        createReport(actor, { ...base, targetType: 'message', targetId: message.id }),
      ).rejects.toBeInstanceOf(NotFound);
      await expect(
        createReport(actor, { ...base, targetType: 'user', targetId: 'user_missing' }),
      ).rejects.toBeInstanceOf(NotFound);
    });
  });

  it('lets a renter report a non-public listing they have a conversation on', async () => {
    await withRollback(async () => {
      const { owner, listing } = await liveListing();
      const renter = await createUser();
      await insertConversation({ listingId: listing.id, hostId: owner.id, renterId: renter.id });
      await db().update(listings).set({ status: 'taken' }).where(eq(listings.id, listing.id));
      await expect(
        createReport(actorFor(renter.id), {
          targetType: 'listing',
          targetId: listing.id,
          reason: 'scam',
        }),
      ).resolves.toMatchObject({ autoHidden: false });
    });
  });

  it('does not reveal a public listing across a block', async () => {
    await withRollback(async () => {
      const { owner, listing } = await liveListing();
      const reporter = await createUser();
      const input = { targetType: 'listing', targetId: listing.id, reason: 'spam' };
      await db().insert(blocks).values({ blockerId: owner.id, blockedId: reporter.id });
      await expect(createReport(actorFor(reporter.id), input)).rejects.toBeInstanceOf(NotFound);
      await db().delete(blocks);
      await db().insert(blocks).values({ blockerId: reporter.id, blockedId: owner.id });
      await expect(createReport(actorFor(reporter.id), input)).rejects.toBeInstanceOf(NotFound);
      await insertConversation({ listingId: listing.id, hostId: owner.id, renterId: reporter.id });
      await expect(createReport(actorFor(reporter.id), input)).resolves.toBeTruthy();
    });
  });

  it('refuses self-reports with field errors', async () => {
    await withRollback(async () => {
      const { owner, listing } = await liveListing();
      const renter = await createUser();
      const conversation = await insertConversation({
        listingId: listing.id,
        hostId: owner.id,
        renterId: renter.id,
      });
      const message = await insertMessage(conversation.id, renter.id, 'mine');
      const base = { reason: 'spam' };
      expect(
        await fieldErrors(
          createReport(actorFor(owner.id), { ...base, targetType: 'user', targetId: owner.id }),
        ),
      ).toEqual({ targetId: ["You can't report yourself"] });
      expect(
        await fieldErrors(
          createReport(actorFor(owner.id), {
            ...base,
            targetType: 'listing',
            targetId: listing.id,
          }),
        ),
      ).toEqual({ targetId: ["You can't report your own listing"] });
      expect(
        await fieldErrors(
          createReport(actorFor(renter.id), {
            ...base,
            targetType: 'message',
            targetId: message.id,
          }),
        ),
      ).toEqual({ targetId: ["You can't report your own message"] });
    });
  });

  it('validates reason and details', async () => {
    await withRollback(async () => {
      const { owner } = await liveListing();
      const actor = actorFor((await createUser()).id);
      const base = { targetType: 'user', targetId: owner.id };
      expect((await fieldErrors(createReport(actor, { ...base, reason: 'bogus' }))).reason).toEqual(
        ['Choose a reason'],
      );
      expect(
        (
          await fieldErrors(
            createReport(actor, { ...base, reason: 'spam', details: 'a'.repeat(1001) }),
          )
        ).details,
      ).toEqual(['Keep details under 1,000 characters']);
    });
  });

  it('limits reports to 20 per rolling 24 hours', async () => {
    await withRollback(async () => {
      const { owner } = await liveListing();
      const reporter = await createUser();
      const old = [];
      for (let i = 0; i < MAX_REPORTS_PER_DAY; i += 1) {
        old.push(
          await insertReport({
            reporterId: reporter.id,
            targetType: 'user',
            targetId: `user_x${i}`,
            status: 'resolved',
            createdAt: new Date(Date.now() - 23 * HOUR),
          }),
        );
      }
      const input = { targetType: 'user', targetId: owner.id, reason: 'spam' };
      await expect(createReport(actorFor(reporter.id), input)).rejects.toThrow(
        new RateLimited(REPORT_RATE_LIMITED),
      );
      await db()
        .update(reports)
        .set({ createdAt: new Date(Date.now() - 25 * HOUR) })
        .where(eq(reports.id, old[0].id));
      await expect(createReport(actorFor(reporter.id), input)).resolves.toBeTruthy();
    });
  });

  it('requires sign-in', async () => {
    await expect(
      createReport(ANONYMOUS, { targetType: 'user', targetId: 'x', reason: 'spam' }),
    ).rejects.toBeInstanceOf(Forbidden);
  });
});

describe('auto-hide', () => {
  const reportListing = (reporterId: string, listingId: string) =>
    createReport(actorFor(reporterId), {
      targetType: 'listing',
      targetId: listingId,
      reason: 'scam',
    });

  it('auto-hides an approved listing at 3 distinct reporters', async () => {
    await withRollback(async () => {
      const { listing } = await liveListing();
      // now() is frozen in the test transaction, so backdate the listing before reports arrive
      await db()
        .update(listings)
        .set({ createdAt: new Date(Date.now() - HOUR) })
        .where(eq(listings.id, listing.id));
      const [a, b, c] = [await createUser(), await createUser(), await createUser()];
      const first = await reportListing(a.id, listing.id);
      await db().update(reports).set({ status: 'resolved' }).where(eq(reports.id, first.id));
      await reportListing(a.id, listing.id);
      expect((await reportListing(b.id, listing.id)).autoHidden).toBe(false);
      const [still] = await db().select().from(listings).where(eq(listings.id, listing.id));
      expect(still.reviewStatus).toBe('approved');

      expect((await reportListing(c.id, listing.id)).autoHidden).toBe(true);
      const [hidden] = await db().select().from(listings).where(eq(listings.id, listing.id));
      expect(hidden.reviewStatus).toBe('hidden');
      const audit = await auditRows(listing.id);
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        action: 'auto_hid_listing',
        adminId: null,
        targetType: 'listing',
        targetId: listing.id,
      });
    });
  });

  it('counts only reports after the latest review', async () => {
    await withRollback(async () => {
      const { listing } = await liveListing();
      const reporters = [
        await createUser(),
        await createUser(),
        await createUser(),
        await createUser(),
      ];
      await db()
        .update(listings)
        .set({ reviewedAt: new Date(Date.now() - HOUR / 2) })
        .where(eq(listings.id, listing.id));
      for (const u of reporters.slice(0, 2)) {
        await insertReport({
          reporterId: u.id,
          targetType: 'listing',
          targetId: listing.id,
          createdAt: new Date(Date.now() - HOUR),
        });
      }
      expect((await reportListing(reporters[2].id, listing.id)).autoHidden).toBe(false);
      await insertReport({
        reporterId: (await createUser()).id,
        targetType: 'listing',
        targetId: listing.id,
      });
      expect((await reportListing(reporters[3].id, listing.id)).autoHidden).toBe(true);
    });
  });

  it('does not auto-hide pending listings and never hides users', async () => {
    await withRollback(async () => {
      const { owner, school } = await liveListing();
      const pending = await insertListing(owner.id, school.id);
      const target = await createUser();
      for (let i = 0; i < 3; i += 1) {
        const reporter = await createUser();
        await insertConversation({
          listingId: pending.id,
          hostId: owner.id,
          renterId: reporter.id,
        });
        expect((await reportListing(reporter.id, pending.id)).autoHidden).toBe(false);
        await createReport(actorFor(reporter.id), {
          targetType: 'user',
          targetId: target.id,
          reason: 'scam',
        });
      }
      const [row] = await db().select().from(listings).where(eq(listings.id, pending.id));
      expect(row.reviewStatus).toBe('pending');
      const [user] = await db().select().from(users).where(eq(users.id, target.id));
      expect(user.status).toBe('active');
      expect(await auditRows(pending.id)).toHaveLength(0);
      expect(
        await db()
          .select()
          .from(adminAuditLog)
          .where(and(eq(adminAuditLog.targetType, 'user'), eq(adminAuditLog.targetId, target.id))),
      ).toHaveLength(0);
    });
  });
});
