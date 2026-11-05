import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/server/db/client';
import { blocks, conversations, listings, messages, users } from '@/server/db/schema';
import { publishToUser } from '@/server/realtime/publish';
import { ANONYMOUS } from '@/server/services/actor';
import { Forbidden, NotFound, RateLimited, ValidationError } from '@/server/services/errors';
import {
  composerStateFor,
  markConversationRead,
  sendMessage,
  startConversation,
} from '@/server/services/messaging';
import { withRollback } from '../helpers/db';
import { actorFor, createUser } from '../helpers/fixtures';
import { insertConversation, insertMessage, liveListing } from '../helpers/messaging';

vi.mock('@/server/realtime/publish', () => ({
  publishToUser: vi.fn().mockResolvedValue(undefined),
}));

// Lets a test run a statement right after the lock, as a concurrent ban would.
const afterLock = vi.hoisted(() => ({ hook: null as null | (() => Promise<void>) }));
vi.mock('@/server/services/locks', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/server/services/locks')>();
  return {
    ...original,
    lockMessagingUsers: async (...args: Parameters<typeof original.lockMessagingUsers>) => {
      await original.lockMessagingUsers(...args);
      await afterLock.hook?.();
    },
  };
});

beforeEach(() => {
  vi.mocked(publishToUser).mockReset();
  vi.mocked(publishToUser).mockResolvedValue(undefined);
});

const ago = (ms: number): Date => new Date(Date.now() - ms);
const HOUR = 3_600_000;

async function setup() {
  const { owner, listing } = await liveListing();
  const renter = await createUser();
  const conversation = await insertConversation({
    listingId: listing.id,
    hostId: owner.id,
    renterId: renter.id,
  });
  return { owner, renter, listing, conversation };
}

describe('startConversation', () => {
  it('creates the conversation with the first message and publishes to both users', () =>
    withRollback(async () => {
      const { owner, listing } = await liveListing();
      const renter = await createUser();
      const result = await startConversation(actorFor(renter.id), {
        listingId: listing.id,
        body: 'Is this still available?',
      });
      expect(result.message).toEqual({
        id: expect.any(String),
        conversationId: result.conversationId,
        senderId: renter.id,
        body: 'Is this still available?',
        createdAt: expect.any(String),
      });
      const [row] = await db()
        .select()
        .from(conversations)
        .where(eq(conversations.id, result.conversationId));
      expect(row).toMatchObject({ listingId: listing.id, hostId: owner.id, renterId: renter.id });
      expect(row.lastMessageAt.toISOString()).toBe(result.message.createdAt);
      expect(row.renterLastReadAt?.toISOString()).toBe(result.message.createdAt);
      expect(row.hostLastReadAt).toBeNull();
      const event = {
        type: 'message',
        conversationId: result.conversationId,
        message: result.message,
      };
      expect(publishToUser).toHaveBeenCalledTimes(2);
      expect(publishToUser).toHaveBeenCalledWith(owner.id, event);
      expect(publishToUser).toHaveBeenCalledWith(renter.id, event);
    }));

  it('starting twice reuses the conversation', () =>
    withRollback(async () => {
      const { listing } = await liveListing();
      const renter = await createUser();
      const first = await startConversation(actorFor(renter.id), {
        listingId: listing.id,
        body: 'one',
      });
      const second = await startConversation(actorFor(renter.id), {
        listingId: listing.id,
        body: 'two',
      });
      expect(second.conversationId).toBe(first.conversationId);
      expect(
        await db().select().from(conversations).where(eq(conversations.listingId, listing.id)),
      ).toHaveLength(1);
      expect(
        await db().select().from(messages).where(eq(messages.conversationId, first.conversationId)),
      ).toHaveLength(2);
    }));

  it('does not count a reused conversation toward the daily limit', () =>
    withRollback(async () => {
      const { owner, listing } = await liveListing();
      const me = await createUser();
      for (let i = 0; i < 14; i += 1) {
        await insertConversation({ listingId: null, hostId: owner.id, renterId: me.id });
      }
      await insertConversation({ listingId: listing.id, hostId: owner.id, renterId: me.id });
      await expect(
        startConversation(actorFor(me.id), { listingId: listing.id, body: 'hi' }),
      ).resolves.toBeDefined();
    }));

  it('refuses your own listing', () =>
    withRollback(async () => {
      const { owner, listing } = await liveListing();
      const error = await startConversation(actorFor(owner.id), {
        listingId: listing.id,
        body: 'hi',
      }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(Forbidden);
      expect((error as Error).message).toBe("You can't message yourself");
    }));

  it('refuses a listing that is not public', () =>
    withRollback(async () => {
      const renter = await createUser();
      const cases: Array<(ids: { listingId: string; ownerId: string }) => Promise<unknown>> = [
        ({ listingId }) =>
          db().update(listings).set({ reviewStatus: 'pending' }).where(eq(listings.id, listingId)),
        ({ listingId }) =>
          db().update(listings).set({ status: 'taken' }).where(eq(listings.id, listingId)),
        ({ listingId }) =>
          db()
            .update(listings)
            .set({ availableFrom: '2019-01-01', availableTo: '2020-01-01' })
            .where(eq(listings.id, listingId)),
        ({ ownerId }) => db().update(users).set({ status: 'banned' }).where(eq(users.id, ownerId)),
      ];
      for (const breakIt of cases) {
        const { owner, listing } = await liveListing();
        await breakIt({ listingId: listing.id, ownerId: owner.id });
        await expect(
          startConversation(actorFor(renter.id), { listingId: listing.id, body: 'hi' }),
        ).rejects.toBeInstanceOf(NotFound);
      }
    }));

  it('refuses when a block exists in either direction', () =>
    withRollback(async () => {
      const { owner, listing } = await liveListing();
      const renter = await createUser();
      await db().insert(blocks).values({ blockerId: renter.id, blockedId: owner.id });
      await expect(
        startConversation(actorFor(renter.id), { listingId: listing.id, body: 'hi' }),
      ).rejects.toBeInstanceOf(NotFound);
      await db().delete(blocks);
      await db().insert(blocks).values({ blockerId: owner.id, blockedId: renter.id });
      await expect(
        startConversation(actorFor(renter.id), { listingId: listing.id, body: 'hi' }),
      ).rejects.toBeInstanceOf(NotFound);
    }));

  it('refuses a banned sender', () =>
    withRollback(async () => {
      const { listing } = await liveListing();
      const renter = await createUser({ status: 'banned' });
      await expect(
        startConversation(actorFor(renter.id), { listingId: listing.id, body: 'hi' }),
      ).rejects.toThrow("You can't reply to this conversation");
    }));

  it('re-checks the sender ban inside the transaction for a new conversation', () =>
    withRollback(async () => {
      const { listing } = await liveListing();
      const renter = await createUser();
      afterLock.hook = async () => {
        await db().update(users).set({ status: 'banned' }).where(eq(users.id, renter.id));
      };
      try {
        await expect(
          startConversation(actorFor(renter.id), { listingId: listing.id, body: 'hi' }),
        ).rejects.toThrow("You can't reply to this conversation");
      } finally {
        afterLock.hook = null;
      }
      expect(
        await db().select().from(conversations).where(eq(conversations.listingId, listing.id)),
      ).toHaveLength(0);
    }));

  it('refuses a signed-in actor with no users row', () =>
    withRollback(async () => {
      const { listing } = await liveListing();
      await expect(
        startConversation(actorFor('user_not_synced'), { listingId: listing.id, body: 'hi' }),
      ).rejects.toBeInstanceOf(Forbidden);
    }));

  it('requires sign-in', () =>
    withRollback(async () => {
      const { listing } = await liveListing();
      await expect(
        startConversation(ANONYMOUS, { listingId: listing.id, body: 'hi' }),
      ).rejects.toBeInstanceOf(Forbidden);
    }));

  it('limits new conversations to 15 per rolling 24 hours', () =>
    withRollback(async () => {
      const { owner, listing } = await liveListing();
      const me = await createUser();
      const rows = [];
      for (let i = 0; i < 15; i += 1) {
        rows.push(
          await insertConversation({
            listingId: null,
            hostId: owner.id,
            renterId: me.id,
            createdAt: ago(23 * HOUR),
          }),
        );
      }
      const attempt = () =>
        startConversation(actorFor(me.id), { listingId: listing.id, body: 'hi' });
      const error = await attempt().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(RateLimited);
      expect((error as Error).message).toBe(
        'You can start up to 15 new conversations a day — try again tomorrow',
      );
      await db()
        .update(conversations)
        .set({ createdAt: ago(25 * HOUR) })
        .where(eq(conversations.id, rows[0].id));
      await expect(attempt()).resolves.toBeDefined();
    }));
});

describe('sendMessage', () => {
  it('lets both participants send, and bumps last_message_at', () =>
    withRollback(async () => {
      const { owner, renter, conversation } = await setup();
      const first = await sendMessage(actorFor(renter.id), {
        conversationId: conversation.id,
        body: 'hello',
      });
      const second = await sendMessage(actorFor(owner.id), {
        conversationId: conversation.id,
        body: 'hi there',
      });
      const rows = await db()
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
        .orderBy(messages.createdAt);
      expect(rows.map((row) => row.body)).toEqual(['hello', 'hi there']);
      expect(first.message.createdAt).not.toBe(second.message.createdAt);
      const [row] = await db()
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversation.id));
      expect(row.lastMessageAt.toISOString()).toBe(second.message.createdAt);
    }));

  it('validates the body', () =>
    withRollback(async () => {
      const { renter, conversation } = await setup();
      const send = (body: string) =>
        sendMessage(actorFor(renter.id), { conversationId: conversation.id, body });
      const blank = await send('   ').catch((e: unknown) => e);
      expect(blank).toBeInstanceOf(ValidationError);
      expect((blank as ValidationError).fieldErrors.body).toEqual(['Write a message']);
      const long = await send('a'.repeat(2001)).catch((e: unknown) => e);
      expect((long as ValidationError).fieldErrors.body).toEqual([
        'Messages can be up to 2,000 characters',
      ]);
      await expect(send('a'.repeat(2000))).resolves.toBeDefined();
      expect((await send('  hi  ')).message.body).toBe('hi');
      await expect(send('😀'.repeat(1000))).resolves.toBeDefined();
    }));

  it('hides conversations from non-participants', () =>
    withRollback(async () => {
      const { conversation } = await setup();
      const stranger = await createUser();
      const send = (actorId: string, isAdmin: boolean, id: string) =>
        sendMessage(actorFor(actorId, isAdmin), { conversationId: id, body: 'hi' });
      await expect(send(stranger.id, false, conversation.id)).rejects.toBeInstanceOf(NotFound);
      await expect(send(stranger.id, true, conversation.id)).rejects.toBeInstanceOf(NotFound);
      await expect(send(stranger.id, false, 'not-a-uuid')).rejects.toBeInstanceOf(NotFound);
    }));

  it('refuses a blocked send without inserting a message', () =>
    withRollback(async () => {
      const { owner, renter, conversation } = await setup();
      await db().insert(blocks).values({ blockerId: owner.id, blockedId: renter.id });
      const count = async (): Promise<number> =>
        (await db().select().from(messages).where(eq(messages.conversationId, conversation.id)))
          .length;
      const before = await count();
      await expect(
        sendMessage(actorFor(renter.id), { conversationId: conversation.id, body: 'hi' }),
      ).rejects.toThrow("You can't reply to this conversation");
      expect(await count()).toBe(before);
    }));

  it('refuses when a block exists, without revealing it to the blocked user', () =>
    withRollback(async () => {
      const { owner, renter, conversation } = await setup();
      await db().insert(blocks).values({ blockerId: owner.id, blockedId: renter.id });
      await expect(
        sendMessage(actorFor(owner.id), { conversationId: conversation.id, body: 'hi' }),
      ).rejects.toThrow('You blocked this user');
      await expect(
        sendMessage(actorFor(renter.id), { conversationId: conversation.id, body: 'hi' }),
      ).rejects.toThrow("You can't reply to this conversation");
    }));

  it('refuses when either participant is banned', () =>
    withRollback(async () => {
      const { owner, renter, conversation } = await setup();
      await db().update(users).set({ status: 'banned' }).where(eq(users.id, owner.id));
      await expect(
        sendMessage(actorFor(renter.id), { conversationId: conversation.id, body: 'hi' }),
      ).rejects.toThrow("You can't reply to this conversation");
    }));

  it('refuses to send to a deleted participant', () =>
    withRollback(async () => {
      const { owner, renter, conversation } = await setup();
      await db().delete(users).where(eq(users.id, owner.id));
      await expect(
        sendMessage(actorFor(renter.id), { conversationId: conversation.id, body: 'hi' }),
      ).rejects.toThrow('This account was deleted');
    }));

  it('keeps working after the listing stops being public or is deleted', () =>
    withRollback(async () => {
      const { renter, listing, conversation } = await setup();
      const send = () =>
        sendMessage(actorFor(renter.id), { conversationId: conversation.id, body: 'hi' });
      await db().update(listings).set({ status: 'taken' }).where(eq(listings.id, listing.id));
      await expect(send()).resolves.toBeDefined();
      await db().delete(listings).where(eq(listings.id, listing.id));
      const [row] = await db()
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversation.id));
      expect(row.listingId).toBeNull();
      await expect(send()).resolves.toBeDefined();
    }));

  it('limits messages to 30 per rolling minute', () =>
    withRollback(async () => {
      const { owner, renter, conversation } = await setup();
      const old: Array<typeof messages.$inferSelect> = [];
      for (let i = 0; i < 30; i += 1) {
        old.push(await insertMessage(conversation.id, renter.id, `m${i}`, ago(30_000)));
      }
      const send = () =>
        sendMessage(actorFor(renter.id), { conversationId: conversation.id, body: 'hi' });
      await expect(send()).rejects.toThrow("You're sending messages too fast — wait a minute");
      await expect(send()).rejects.toBeInstanceOf(RateLimited);
      await db()
        .update(messages)
        .set({ createdAt: ago(61_000) })
        .where(eq(messages.id, old[0].id));
      await expect(send()).resolves.toBeDefined();
      // The other participant's messages are not counted.
      await expect(
        sendMessage(actorFor(owner.id), { conversationId: conversation.id, body: 'hey' }),
      ).resolves.toBeDefined();
    }));

  it('a failed broadcast does not fail the send', () =>
    withRollback(async () => {
      const { renter, conversation } = await setup();
      vi.mocked(publishToUser).mockRejectedValue(new Error('down'));
      const result = await sendMessage(actorFor(renter.id), {
        conversationId: conversation.id,
        body: 'hi',
      });
      const rows = await db().select().from(messages).where(eq(messages.id, result.message.id));
      expect(rows).toHaveLength(1);
    }));
});

describe('markConversationRead', () => {
  it("sets only the caller's read time", () =>
    withRollback(async () => {
      const { renter, conversation } = await setup();
      await insertMessage(conversation.id, renter.id, 'hi', ago(HOUR));
      await markConversationRead(actorFor(renter.id), conversation.id);
      const [row] = await db()
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversation.id));
      expect(row.renterLastReadAt && row.renterLastReadAt >= row.lastMessageAt).toBe(true);
      expect(row.hostLastReadAt).toBeNull();
    }));

  it('hides conversations from non-participants', () =>
    withRollback(async () => {
      const { conversation } = await setup();
      const stranger = await createUser();
      await expect(
        markConversationRead(actorFor(stranger.id), conversation.id),
      ).rejects.toBeInstanceOf(NotFound);
      await expect(markConversationRead(actorFor(stranger.id), 'nope')).rejects.toBeInstanceOf(
        NotFound,
      );
    }));
});

describe('composerStateFor', () => {
  it('returns each state', () =>
    withRollback(async () => {
      const me = await createUser();
      const other = await createUser();
      expect(await composerStateFor(me.id, other.id)).toBe('open');
      await db().insert(blocks).values({ blockerId: me.id, blockedId: other.id });
      expect(await composerStateFor(me.id, other.id)).toBe('you_blocked');
      await db().insert(blocks).values({ blockerId: other.id, blockedId: me.id });
      expect(await composerStateFor(me.id, other.id)).toBe('you_blocked');
      await db().delete(blocks).where(eq(blocks.blockerId, me.id));
      expect(await composerStateFor(me.id, other.id)).toBe('cannot_reply');
      await db().delete(blocks);
      await db().update(users).set({ status: 'banned' }).where(eq(users.id, other.id));
      expect(await composerStateFor(me.id, other.id)).toBe('cannot_reply');
      expect(await composerStateFor(me.id, null)).toBe('deleted_user');
    }));
});
