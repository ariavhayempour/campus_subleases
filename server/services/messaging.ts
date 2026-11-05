import * as Sentry from '@sentry/nextjs';
import { and, count, eq, gt, inArray, sql } from 'drizzle-orm';
import {
  MAX_MESSAGES_PER_MINUTE,
  MAX_NEW_CONVERSATIONS_PER_DAY,
  type ComposerState,
  type MessageView,
  type RealtimeEvent,
} from '@/lib/messaging-options';
import { isUuid } from '@/lib/validation/listing';
import { sendMessageSchema, startConversationSchema } from '@/lib/validation/messaging';
import { db, type DbExecutor } from '@/server/db/client';
import { conversations, listings, messages, schools, users } from '@/server/db/schema';
import { publishToUser } from '@/server/realtime/publish';
import { requireUser, type Actor } from './actor';
import { Forbidden, NotFound, parseInput, RateLimited, ValidationError } from './errors';
import { lockMessagingUsers } from './locks';
import { isPublicListing, noBlockWith } from './listing-sql';
import { getBlockState, type BlockState } from './moderation';

export type SendResult = { conversationId: string; message: MessageView };

type ConversationRow = typeof conversations.$inferSelect;

const CANNOT_REPLY = "You can't reply to this conversation";

export function toMessageView(row: typeof messages.$inferSelect): MessageView {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function composerStateFor(
  viewerId: string,
  otherId: string | null,
  executor: DbExecutor = db(),
): Promise<ComposerState> {
  if (otherId === null) return 'deleted_user';
  return composerStateWithBlock(
    viewerId,
    otherId,
    await getBlockState(viewerId, otherId, executor),
    executor,
  );
}

// Takes an already-read block state so callers that need both do not query twice.
export async function composerStateWithBlock(
  viewerId: string,
  otherId: string,
  { viewerBlocked, blockedByOther }: BlockState,
  executor: DbExecutor = db(),
): Promise<ComposerState> {
  if (viewerBlocked) return 'you_blocked';
  const rows = await executor
    .select({ status: users.status })
    .from(users)
    .where(inArray(users.id, [viewerId, otherId]));
  if (blockedByOther || rows.some((row) => row.status === 'banned')) return 'cannot_reply';
  return 'open';
}

function assertOpen(state: ComposerState): void {
  if (state === 'deleted_user') throw new Forbidden('This account was deleted');
  if (state === 'you_blocked') throw new Forbidden('You blocked this user');
  if (state === 'cannot_reply') throw new Forbidden(CANNOT_REPLY);
}

const otherParticipant = (conversation: ConversationRow, userId: string): string | null =>
  conversation.hostId === userId ? conversation.renterId : conversation.hostId;

const isParticipant = (conversation: ConversationRow, userId: string): boolean =>
  conversation.hostId === userId || conversation.renterId === userId;

async function loadParticipantConversation(
  userId: string,
  conversationId: string,
): Promise<ConversationRow> {
  if (!isUuid(conversationId)) throw new NotFound('Conversation not found');
  const [conversation] = await db()
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId));
  if (!conversation || !isParticipant(conversation, userId)) {
    throw new NotFound('Conversation not found');
  }
  return conversation;
}

async function assertUnderMessageLimit(executor: DbExecutor, userId: string): Promise<void> {
  const [row] = await executor
    .select({ n: count() })
    .from(messages)
    .where(
      and(
        eq(messages.senderId, userId),
        gt(messages.createdAt, sql`clock_timestamp() - interval '1 minute'`),
      ),
    );
  if (row.n >= MAX_MESSAGES_PER_MINUTE) {
    throw new RateLimited("You're sending messages too fast — wait a minute");
  }
}

async function assertUnderConversationLimit(executor: DbExecutor, userId: string): Promise<void> {
  const [row] = await executor
    .select({ n: count() })
    .from(conversations)
    .where(
      and(
        eq(conversations.renterId, userId),
        gt(conversations.createdAt, sql`clock_timestamp() - interval '24 hours'`),
      ),
    );
  if (row.n >= MAX_NEW_CONVERSATIONS_PER_DAY) {
    throw new RateLimited('You can start up to 15 new conversations a day — try again tomorrow');
  }
}

async function insertMessageInto(
  executor: DbExecutor,
  conversation: ConversationRow,
  senderId: string,
  body: string,
): Promise<MessageView> {
  const [row] = await executor
    .insert(messages)
    .values({
      conversationId: conversation.id,
      senderId,
      body,
      createdAt: sql`clock_timestamp()`,
    })
    .returning();
  // Read from the stored row so microseconds survive; greatest() keeps concurrent sends from moving times back.
  const sentAt = sql`(select created_at from ${messages} where id = ${row.id})`;
  const senderReadColumn =
    conversation.hostId === senderId
      ? { hostLastReadAt: sql`greatest(${conversations.hostLastReadAt}, ${sentAt})` }
      : { renterLastReadAt: sql`greatest(${conversations.renterLastReadAt}, ${sentAt})` };
  await executor
    .update(conversations)
    .set({
      lastMessageAt: sql`greatest(${conversations.lastMessageAt}, ${sentAt})`,
      ...senderReadColumn,
    })
    .where(eq(conversations.id, conversation.id));
  return toMessageView(row);
}

async function publishMessage(
  senderId: string,
  recipientId: string | null,
  result: SendResult,
): Promise<void> {
  const event: RealtimeEvent = {
    type: 'message',
    conversationId: result.conversationId,
    message: result.message,
  };
  const targets = recipientId === null ? [senderId] : [recipientId, senderId];
  const outcomes = await Promise.allSettled(targets.map((id) => publishToUser(id, event)));
  for (const outcome of outcomes) {
    if (outcome.status === 'rejected') Sentry.captureException(outcome.reason);
  }
}

// A malformed id reads as "not found" so probing reveals nothing about valid ones.
function parseOrNotFound<T>(parse: () => T, idField: string, notFoundMessage: string): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof ValidationError && error.fieldErrors[idField]) {
      throw new NotFound(notFoundMessage);
    }
    throw error;
  }
}

export async function sendMessage(actor: Actor, input: unknown): Promise<SendResult> {
  const user = requireUser(actor);
  const { conversationId, body } = parseOrNotFound(
    () => parseInput(sendMessageSchema, input),
    'conversationId',
    'Conversation not found',
  );
  const conversation = await loadParticipantConversation(user.userId, conversationId);
  const recipientId = otherParticipant(conversation, user.userId);
  assertOpen(await composerStateFor(user.userId, recipientId));

  const message = await db().transaction(async (tx) => {
    await lockMessagingUsers(tx, [user.userId]);
    assertOpen(await composerStateFor(user.userId, recipientId, tx));
    await assertUnderMessageLimit(tx, user.userId);
    return insertMessageInto(tx, conversation, user.userId, body);
  });
  const result: SendResult = { conversationId: conversation.id, message };
  await publishMessage(user.userId, recipientId, result);
  return result;
}

export async function startConversation(actor: Actor, input: unknown): Promise<SendResult> {
  const user = requireUser(actor);
  const { listingId, body } = parseOrNotFound(
    () => parseInput(startConversationSchema, input),
    'listingId',
    'Listing not found',
  );

  const [listing] = await db()
    .select({ id: listings.id, ownerId: listings.ownerId })
    .from(listings)
    .innerJoin(schools, eq(schools.id, listings.schoolId))
    .innerJoin(users, eq(users.id, listings.ownerId))
    .where(and(eq(listings.id, listingId), isPublicListing, noBlockWith(user.userId)));
  if (!listing) throw new NotFound('Listing not found');
  if (listing.ownerId === user.userId) throw new Forbidden("You can't message yourself");
  const [self] = await db()
    .select({ status: users.status })
    .from(users)
    .where(eq(users.id, user.userId));
  if (!self || self.status === 'banned') throw new Forbidden(CANNOT_REPLY);

  const [existing] = await db()
    .select()
    .from(conversations)
    .where(and(eq(conversations.listingId, listingId), eq(conversations.renterId, user.userId)));
  if (existing)
    assertOpen(await composerStateFor(user.userId, otherParticipant(existing, user.userId)));

  const { conversation, message } = await db().transaction(async (tx) => {
    await lockMessagingUsers(tx, [user.userId]);
    const findConversation = async (): Promise<ConversationRow | undefined> => {
      const [row] = await tx
        .select()
        .from(conversations)
        .where(
          and(eq(conversations.listingId, listingId), eq(conversations.renterId, user.userId)),
        );
      return row;
    };
    let found = await findConversation();
    if (found) {
      assertOpen(await composerStateFor(user.userId, otherParticipant(found, user.userId), tx));
    } else {
      const block = await getBlockState(user.userId, listing.ownerId, tx);
      if (block.viewerBlocked || block.blockedByOther) throw new NotFound('Listing not found');
      assertOpen(await composerStateWithBlock(user.userId, listing.ownerId, block, tx));
    }
    await assertUnderMessageLimit(tx, user.userId);
    if (!found) {
      await assertUnderConversationLimit(tx, user.userId);
      await tx
        .insert(conversations)
        .values({
          listingId,
          hostId: listing.ownerId,
          renterId: user.userId,
          createdAt: sql`clock_timestamp()`,
        })
        .onConflictDoNothing({ target: [conversations.listingId, conversations.renterId] });
      found = await findConversation();
    }
    if (!found) throw new NotFound('Listing not found');
    return { conversation: found, message: await insertMessageInto(tx, found, user.userId, body) };
  });
  const result: SendResult = { conversationId: conversation.id, message };
  await publishMessage(user.userId, listing.ownerId, result);
  return result;
}

export async function markConversationRead(actor: Actor, conversationId: string): Promise<void> {
  const user = requireUser(actor);
  const conversation = await loadParticipantConversation(user.userId, conversationId);
  const readAt = sql`clock_timestamp()`;
  await db()
    .update(conversations)
    .set(
      conversation.hostId === user.userId
        ? { hostLastReadAt: readAt }
        : { renterLastReadAt: readAt },
    )
    .where(eq(conversations.id, conversation.id));
}
