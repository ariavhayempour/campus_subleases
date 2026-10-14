import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { db } from '@/server/db/client';
import { listings, users } from '@/server/db/schema';
import { ANONYMOUS } from '@/server/services/actor';
import { NotFound } from '@/server/services/errors';
import {
  getConversationStart,
  getInbox,
  getThread,
  getUnreadCount,
  listEarlierMessages,
} from '@/server/services/messaging-reads';
import { markConversationRead, startConversation } from '@/server/services/messaging';
import { blockUser, unblockUser } from '@/server/services/moderation';
import { withRollback } from '../helpers/db';
import {
  actorFor,
  createSchool,
  createUser,
  insertListing,
  insertPhoto,
} from '../helpers/fixtures';
import { insertConversation, insertMessage, liveListing } from '../helpers/messaging';

vi.mock('@/server/realtime/publish', () => ({
  publishToUser: vi.fn().mockResolvedValue(undefined),
}));

const MINUTE = 60_000;
const ago = (ms: number): Date => new Date(Date.now() - ms);
const ahead = (ms: number): Date => new Date(Date.now() + ms);

async function setup() {
  const { owner, school, listing } = await liveListing();
  const renter = await createUser();
  const conversation = await insertConversation({
    listingId: listing.id,
    hostId: owner.id,
    renterId: renter.id,
  });
  return { owner, renter, school, listing, conversation };
}

describe('getInbox', () => {
  it('lists my conversations newest first, as host and as renter', () =>
    withRollback(async () => {
      const me = await createUser();
      const school = await createSchool();
      const other = await createUser();
      const make = async (hostId: string, renterId: string, at: Date) => {
        const listing = await insertListing(hostId, school.id, { reviewStatus: 'approved' });
        const conversation = await insertConversation({
          listingId: listing.id,
          hostId,
          renterId,
        });
        await insertMessage(conversation.id, other.id, 'hi', at);
        return conversation;
      };
      const c1 = await make(other.id, me.id, ago(3 * MINUTE));
      const c2 = await make(other.id, me.id, ago(2 * MINUTE));
      const c3 = await make(me.id, other.id, ago(MINUTE));
      const stranger = await createUser();
      await make(stranger.id, other.id, ago(MINUTE));

      const rows = await getInbox(actorFor(me.id));
      expect(rows.map((row) => row.id)).toEqual([c3.id, c2.id, c1.id]);
    }));

  it('shows the listing, the other person, and a preview', () =>
    withRollback(async () => {
      const { owner, renter, listing, conversation } = await setup();
      await db().update(listings).set({ unit: '4B' }).where(eq(listings.id, listing.id));
      await insertPhoto(listing.id, 0);
      const sentAt = ago(MINUTE);
      await insertMessage(conversation.id, owner.id, 'Still available', sentAt);

      const [row] = await getInbox(actorFor(renter.id));
      expect(row).toMatchObject({
        id: conversation.id,
        listing: { id: listing.id, title: listing.title },
        otherUser: { id: owner.id, displayName: owner.displayName },
        preview: 'Still available',
        lastMessageFromMe: false,
        lastMessageAt: sentAt.toISOString(),
        unread: true,
      });
      expect(row.listing?.coverThumbUrl).toEqual(expect.any(String));
      const json = JSON.stringify(row);
      expect(json).not.toContain('4B');
      expect(json).not.toContain(listing.address);
    }));

  it('collapses whitespace and truncates the preview', () =>
    withRollback(async () => {
      const { owner, renter, conversation } = await setup();
      await insertMessage(conversation.id, owner.id, 'a\n\nb', ago(2 * MINUTE));
      expect((await getInbox(actorFor(renter.id)))[0].preview).toBe('a b');
      await insertMessage(conversation.id, owner.id, 'x'.repeat(200), ago(MINUTE));
      expect((await getInbox(actorFor(renter.id)))[0].preview).toBe('x'.repeat(120) + '…');
    }));

  it('marks unread only when the latest message is from the other person and newer than my read time', () =>
    withRollback(async () => {
      const { owner, renter, conversation } = await setup();
      const me = actorFor(renter.id);
      await insertMessage(conversation.id, owner.id, 'one', ago(MINUTE));
      expect((await getInbox(me))[0].unread).toBe(true);
      await markConversationRead(me, conversation.id);
      expect((await getInbox(me))[0].unread).toBe(false);
      await insertMessage(conversation.id, owner.id, 'two', ahead(MINUTE));
      expect((await getInbox(me))[0].unread).toBe(true);
      await insertMessage(conversation.id, renter.id, 'three', ahead(2 * MINUTE));
      const [row] = await getInbox(me);
      expect(row.unread).toBe(false);
      expect(row.lastMessageFromMe).toBe(true);
    }));
});

describe('getUnreadCount', () => {
  it('counts unread conversations', () =>
    withRollback(async () => {
      const me = await createUser();
      const other = await createUser();
      const school = await createSchool();
      const make = async (lastFrom: string, read: boolean) => {
        const listing = await insertListing(other.id, school.id, { reviewStatus: 'approved' });
        const conversation = await insertConversation({
          listingId: listing.id,
          hostId: other.id,
          renterId: me.id,
        });
        await insertMessage(conversation.id, lastFrom, 'hi', ago(MINUTE));
        if (read) await markConversationRead(actorFor(me.id), conversation.id);
      };
      await make(other.id, false);
      await make(other.id, false);
      await make(other.id, true);
      await make(me.id, false);
      expect(await getUnreadCount(actorFor(me.id))).toBe(2);
    }));

  it('is 0 for anonymous', async () => {
    expect(await getUnreadCount(ANONYMOUS)).toBe(0);
  });
});

describe('getThread', () => {
  it('returns messages oldest first with the unit for both participants', () =>
    withRollback(async () => {
      const { owner, renter, listing, conversation } = await setup();
      await db().update(listings).set({ unit: '4B' }).where(eq(listings.id, listing.id));
      const second = await insertMessage(conversation.id, owner.id, 'second', ago(MINUTE));
      const first = await insertMessage(conversation.id, renter.id, 'first', ago(2 * MINUTE));

      const renterView = await getThread(actorFor(renter.id), conversation.id);
      expect(renterView.messages.map((m) => m.id)).toEqual([first.id, second.id]);
      expect(renterView).toMatchObject({ viewerId: renter.id, composer: 'open' });
      expect(renterView.listing?.unit).toBe('4B');
      expect(renterView.otherUser).toEqual({ id: owner.id, displayName: owner.displayName });
      const hostView = await getThread(actorFor(owner.id), conversation.id);
      expect(hostView.listing?.unit).toBe('4B');
      expect(hostView.viewerId).toBe(owner.id);
    }));

  it('hides threads from non-participants and admins', () =>
    withRollback(async () => {
      const { conversation } = await setup();
      const stranger = await createUser();
      const admin = await createUser();
      await expect(getThread(actorFor(stranger.id), conversation.id)).rejects.toBeInstanceOf(
        NotFound,
      );
      await expect(getThread(actorFor(admin.id, true), conversation.id)).rejects.toBeInstanceOf(
        NotFound,
      );
      await expect(getThread(actorFor(stranger.id), 'not-a-uuid')).rejects.toBeInstanceOf(NotFound);
    }));

  it('stays readable when blocked, with the right composer for each side', () =>
    withRollback(async () => {
      const { owner, renter, conversation } = await setup();
      await insertMessage(conversation.id, renter.id, 'hello', ago(MINUTE));
      await blockUser(actorFor(owner.id), { userId: renter.id });
      const hostView = await getThread(actorFor(owner.id), conversation.id);
      expect(hostView.composer).toBe('you_blocked');
      expect(hostView.messages).toHaveLength(1);
      const renterView = await getThread(actorFor(renter.id), conversation.id);
      expect(renterView.composer).toBe('cannot_reply');
      expect(renterView.messages).toHaveLength(1);
      await unblockUser(actorFor(owner.id), { userId: renter.id });
      expect((await getThread(actorFor(owner.id), conversation.id)).composer).toBe('open');
      expect((await getThread(actorFor(renter.id), conversation.id)).composer).toBe('open');
    }));

  it('survives a deleted participant and a deleted listing', () =>
    withRollback(async () => {
      const { owner, renter, conversation } = await setup();
      await insertMessage(conversation.id, owner.id, 'hi', ago(MINUTE));
      await db().delete(users).where(eq(users.id, owner.id));
      const view = await getThread(actorFor(renter.id), conversation.id);
      expect(view.otherUser).toBeNull();
      expect(view.listing).toBeNull();
      expect(view.composer).toBe('deleted_user');
      expect(view.messages[0].senderId).toBeNull();
    }));

  it('marks the listing linkable only when the viewer can open it', () =>
    withRollback(async () => {
      const { owner, renter, listing, conversation } = await setup();
      expect((await getThread(actorFor(renter.id), conversation.id)).listing?.linkable).toBe(true);
      await db().update(listings).set({ status: 'taken' }).where(eq(listings.id, listing.id));
      expect((await getThread(actorFor(renter.id), conversation.id)).listing?.linkable).toBe(false);
      expect((await getThread(actorFor(owner.id), conversation.id)).listing?.linkable).toBe(true);
    }));

  it('pages at 100 messages', () =>
    withRollback(async () => {
      const { owner, renter, conversation } = await setup();
      const ids: string[] = [];
      for (let i = 0; i < 101; i += 1) {
        const row = await insertMessage(
          conversation.id,
          i % 2 ? owner.id : renter.id,
          `m${i}`,
          ago((101 - i) * 1000),
        );
        ids.push(row.id);
      }
      const view = await getThread(actorFor(renter.id), conversation.id);
      expect(view.messages).toHaveLength(100);
      expect(view.hasEarlier).toBe(true);
      expect(view.messages[0].id).toBe(ids[1]);
      expect(view.messages[99].id).toBe(ids[100]);

      const earlier = await listEarlierMessages(actorFor(renter.id), {
        conversationId: conversation.id,
        before: view.messages[0].id,
      });
      expect(earlier.messages.map((m) => m.id)).toEqual([ids[0]]);
      expect(earlier.hasEarlier).toBe(false);

      const { conversation: other, renter: otherRenter } = await setup();
      const foreign = await insertMessage(other.id, otherRenter.id, 'x', ago(MINUTE));
      await expect(
        listEarlierMessages(actorFor(renter.id), {
          conversationId: conversation.id,
          before: foreign.id,
        }),
      ).rejects.toBeInstanceOf(NotFound);
    }));
});

describe('getConversationStart', () => {
  it('returns the listing and host with no unit, and the existing conversation if any', () =>
    withRollback(async () => {
      const { owner, listing } = await liveListing();
      await db().update(listings).set({ unit: '4B' }).where(eq(listings.id, listing.id));
      const renter = await createUser();
      const actor = actorFor(renter.id);
      const before = await getConversationStart(actor, listing.id);
      expect(before.existingConversationId).toBeNull();
      expect(before.listing).toMatchObject({ id: listing.id, unit: null });
      expect(before.host).toEqual({ id: owner.id, displayName: owner.displayName });
      const started = await startConversation(actor, { listingId: listing.id, body: 'hello' });
      const after = await getConversationStart(actor, listing.id);
      expect(after.existingConversationId).toBe(started.conversationId);
    }));

  it('refuses own, non-public, and blocked listings', () =>
    withRollback(async () => {
      const { owner, school, listing } = await liveListing();
      const renter = await createUser();
      const pending = await insertListing(owner.id, school.id, { reviewStatus: 'pending' });
      await expect(getConversationStart(actorFor(owner.id), listing.id)).rejects.toBeInstanceOf(
        NotFound,
      );
      await expect(getConversationStart(actorFor(renter.id), pending.id)).rejects.toBeInstanceOf(
        NotFound,
      );
      await blockUser(actorFor(renter.id), { userId: owner.id });
      await expect(getConversationStart(actorFor(renter.id), listing.id)).rejects.toBeInstanceOf(
        NotFound,
      );
      await unblockUser(actorFor(renter.id), { userId: owner.id });
      await blockUser(actorFor(owner.id), { userId: renter.id });
      await expect(getConversationStart(actorFor(renter.id), listing.id)).rejects.toBeInstanceOf(
        NotFound,
      );
    }));
});
