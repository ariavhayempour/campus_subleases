import { describe, expect, it } from 'vitest';
import { getTrialStats, type SchoolStats } from '@/server/services/admin-stats';
import { Forbidden, ValidationError } from '@/server/services/errors';
import { withRollback } from '../helpers/db';
import { actorFor, createSchool, createUser, insertListing } from '../helpers/fixtures';
import { insertConversation, insertMessage } from '../helpers/messaging';
import { insertAudit } from '../helpers/moderation';

const at = (iso: string): Date => new Date(iso);
const RANGE = { from: '2026-03-01', to: '2026-03-31' };

async function admin() {
  const user = await createUser();
  return actorFor(user.id, true);
}

async function statsFor(
  schoolSlug: string,
  input: unknown = RANGE,
  actor?: Awaited<ReturnType<typeof admin>>,
): Promise<SchoolStats> {
  const rows = await getTrialStats(actor ?? (await admin()), input);
  const row = rows.find((r) => r.schoolSlug === schoolSlug);
  if (!row) throw new Error('school row missing');
  return row;
}

async function fieldErrors(promise: Promise<unknown>): Promise<Record<string, string[]>> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ValidationError) return error.fieldErrors;
    throw error;
  }
  throw new Error('Expected ValidationError');
}

describe('trial stats', () => {
  it('admins only', () =>
    withRollback(async () => {
      const user = await createUser();
      await expect(getTrialStats(actorFor(user.id), RANGE)).rejects.toBeInstanceOf(Forbidden);
    }));

  it('counts listings posted and taken in the range, in the school timezone', () =>
    withRollback(async () => {
      const owner = await createUser();
      const school = await createSchool({ timezone: 'America/Chicago' });
      // 2026-03-01 05:30 UTC is still 2026-02-28 in Chicago
      await insertListing(owner.id, school.id, { createdAt: at('2026-03-01T05:30:00Z') });
      await insertListing(owner.id, school.id, {
        createdAt: at('2026-03-01T07:00:00Z'),
        takenAt: at('2026-03-10T12:00:00Z'),
      });
      await insertListing(owner.id, school.id, { createdAt: at('2026-04-01T06:00:00Z') });
      // 2026-03-01 05:30 UTC is still Feb 28 in Chicago
      await insertListing(owner.id, school.id, {
        createdAt: at('2026-01-01T12:00:00Z'),
        takenAt: at('2026-03-01T05:30:00Z'),
      });
      const march = await statsFor(school.slug);
      expect(march.listingsPosted).toBe(1);
      expect(march.listingsTaken).toBe(1);
      const feb = await statsFor(school.slug, { from: '2026-02-28', to: '2026-02-28' });
      expect(feb.listingsPosted).toBe(1);
      expect(feb.listingsTaken).toBe(1);
    }));

  it('computes the approved-with-message share from audit rows', () =>
    withRollback(async () => {
      const owner = await createUser();
      const renter = await createUser();
      const school = await createSchool();
      const created = at('2026-03-10T12:00:00Z');
      const listingsCreated = [];
      for (let i = 0; i < 4; i += 1) {
        listingsCreated.push(
          await insertListing(owner.id, school.id, {
            createdAt: created,
            reviewStatus: 'approved',
          }),
        );
      }
      for (const l of listingsCreated.slice(0, 3)) {
        await insertAudit({ action: 'approved_listing', targetType: 'listing', targetId: l.id });
      }
      for (const l of listingsCreated.slice(0, 2)) {
        await insertConversation({ listingId: l.id, hostId: owner.id, renterId: renter.id });
      }
      // a repeat approval and a second renter's conversation must not inflate the counts
      await insertAudit({
        action: 'approved_listing',
        targetType: 'listing',
        targetId: listingsCreated[0].id,
      });
      const renter2 = await createUser();
      await insertConversation({
        listingId: listingsCreated[0].id,
        hostId: owner.id,
        renterId: renter2.id,
      });
      // the fourth was approved by SQL only and has a conversation
      await insertConversation({
        listingId: listingsCreated[3].id,
        hostId: owner.id,
        renterId: renter.id,
      });
      const stats = await statsFor(school.slug);
      expect(stats.listingsPosted).toBe(4);
      expect(stats.approvedListings).toBe(3);
      expect(stats.approvedWithMessage).toBe(2);
    }));

  it('computes the median first host reply', () =>
    withRollback(async () => {
      const host = await createUser();
      const renter = await createUser();
      const school = await createSchool();
      const base = at('2026-03-10T12:00:00Z').getTime();
      const minutes = (m: number) => new Date(base + m * 60_000);
      const replyAfter = async (replyMin: number | null, renterSecond = false) => {
        const listing = await insertListing(host.id, school.id, { createdAt: minutes(-60) });
        const convo = await insertConversation({
          listingId: listing.id,
          hostId: host.id,
          renterId: renter.id,
          createdAt: minutes(0),
        });
        await insertMessage(convo.id, renter.id, 'hi', minutes(0));
        if (renterSecond) await insertMessage(convo.id, renter.id, 'hello?', minutes(1));
        if (replyMin !== null) await insertMessage(convo.id, host.id, 'hey', minutes(replyMin));
      };
      await replyAfter(10);
      await replyAfter(30, true);
      await replyAfter(110);
      await replyAfter(null);
      // replied conversation created before the range must not affect the result
      const oldListing = await insertListing(host.id, school.id, {
        createdAt: at('2026-01-01T12:00:00Z'),
      });
      const oldConvo = await insertConversation({
        listingId: oldListing.id,
        hostId: host.id,
        renterId: renter.id,
        createdAt: at('2026-02-10T12:00:00Z'),
      });
      await insertMessage(oldConvo.id, renter.id, 'hi', at('2026-02-10T12:00:00Z'));
      await insertMessage(oldConvo.id, host.id, 'hey', at('2026-02-10T12:00:05Z'));
      const stats = await statsFor(school.slug);
      expect(stats.medianFirstReplySeconds).toBe(1800);
      expect(stats.repliedConversations).toBe(3);
    }));

  it('handles empty ranges and validates the range', () =>
    withRollback(async () => {
      const school = await createSchool();
      const empty = await statsFor(school.slug);
      expect(empty).toMatchObject({
        listingsPosted: 0,
        approvedListings: 0,
        approvedWithMessage: 0,
        repliedConversations: 0,
        medianFirstReplySeconds: null,
        listingsTaken: 0,
      });
      const actor = await admin();
      expect(
        (await fieldErrors(getTrialStats(actor, { from: '2026-03-02', to: '2026-03-01' }))).to,
      ).toEqual(['The end date must be on or after the start date']);
      expect(
        (await fieldErrors(getTrialStats(actor, { from: '2025-01-01', to: '2026-02-05' }))).to,
      ).toEqual(['Choose a range of a year or less']);
      expect(
        (await fieldErrors(getTrialStats(actor, { from: '', to: '2026-03-01' }))).from,
      ).toEqual(['Choose a date']);
    }));
});
