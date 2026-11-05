import { and, desc, eq, ne, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  INBOX_LIMIT,
  PREVIEW_LENGTH,
  THREAD_PAGE_SIZE,
  type ComposerState,
  type MessageView,
} from '@/lib/messaging-options';
import { isUuid } from '@/lib/validation/listing';
import { earlierMessagesSchema } from '@/lib/validation/messaging';
import { db } from '@/server/db/client';
import {
  conversations,
  listingPhotos,
  listings,
  messages,
  schools,
  users,
} from '@/server/db/schema';
import { requireUser, type Actor } from './actor';
import { NotFound, parseInput, ValidationError } from './errors';
import { coverJoin } from './listing-cards';
import { isPublicListing, noBlockWith } from './listing-sql';
import { composerStateWithBlock, toMessageView } from './messaging';
import { getBlockState } from './moderation';
import { photoUrls } from './photos';

export type Participant = { id: string; displayName: string };

export type InboxRow = {
  id: string;
  listing: { id: string; title: string; coverThumbUrl: string | null } | null;
  otherUser: Participant | null;
  preview: string;
  lastMessageFromMe: boolean;
  lastMessageAt: string; // ISO
  unread: boolean;
};

export type ThreadListing = {
  id: string;
  title: string;
  schoolSlug: string;
  coverThumbUrl: string | null;
  address: string;
  unit: string | null;
  linkable: boolean; // the viewer can open the listing page
};

export type ThreadView = {
  id: string;
  viewerId: string;
  listing: ThreadListing | null;
  otherUser: Participant | null;
  composer: ComposerState;
  messages: MessageView[]; // oldest first
  hasEarlier: boolean;
};

export type ConversationStart = {
  existingConversationId: string | null;
  listing: ThreadListing; // unit is always null here
  host: Participant;
};

const conversationNotFound = (): NotFound => new NotFound('Conversation not found');

const isParticipantOf = (userId: string): SQL =>
  or(eq(conversations.hostId, userId), eq(conversations.renterId, userId)) as SQL;

const myLastReadAt = (userId: string): SQL =>
  sql`coalesce(case when ${conversations.hostId} = ${userId} then ${conversations.hostLastReadAt} else ${conversations.renterLastReadAt} end, '-infinity'::timestamptz)`;

const latestSenderId = sql`(select ${messages.senderId} from ${messages} where ${messages.conversationId} = ${conversations.id} order by ${messages.createdAt} desc, ${messages.id} desc limit 1)`;

function toPreview(body: string): string {
  const collapsed = body.replace(/\s+/g, ' ').trim();
  const chars = Array.from(collapsed);
  return chars.length > PREVIEW_LENGTH ? `${chars.slice(0, PREVIEW_LENGTH).join('')}…` : collapsed;
}

export async function getInbox(actor: Actor): Promise<InboxRow[]> {
  const user = requireUser(actor);
  const other = alias(users, 'other_user');
  const latest = db()
    .select({ body: messages.body, senderId: messages.senderId })
    .from(messages)
    .where(eq(messages.conversationId, conversations.id))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(1)
    .as('latest');
  const rows = await db()
    .select({
      id: conversations.id,
      listingId: listings.id,
      listingTitle: listings.title,
      coverPath: listingPhotos.storagePath,
      otherId: other.id,
      otherName: other.displayName,
      body: latest.body,
      senderId: latest.senderId,
      lastMessageAt: conversations.lastMessageAt,
      unread: sql<boolean>`(${conversations.lastMessageAt} > ${myLastReadAt(user.userId)} and ${latest.senderId} is distinct from ${user.userId})`,
    })
    .from(conversations)
    .leftJoinLateral(latest, sql`true`)
    .leftJoin(listings, eq(listings.id, conversations.listingId))
    .leftJoin(listingPhotos, coverJoin)
    .leftJoin(
      other,
      eq(
        other.id,
        sql`case when ${conversations.hostId} = ${user.userId} then ${conversations.renterId} else ${conversations.hostId} end`,
      ),
    )
    .where(isParticipantOf(user.userId))
    .orderBy(desc(conversations.lastMessageAt), desc(conversations.id))
    .limit(INBOX_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    listing: row.listingId
      ? {
          id: row.listingId,
          title: row.listingTitle ?? '',
          coverThumbUrl: row.coverPath ? photoUrls(row.coverPath).thumb : null,
        }
      : null,
    otherUser: row.otherId ? { id: row.otherId, displayName: row.otherName ?? '' } : null,
    preview: toPreview(row.body ?? ''),
    lastMessageFromMe: row.senderId === user.userId,
    lastMessageAt: row.lastMessageAt.toISOString(),
    unread: row.unread,
  }));
}

export async function getUnreadCount(actor: Actor): Promise<number> {
  if (actor.kind !== 'user') return 0;
  const [row] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(conversations)
    .where(
      and(
        isParticipantOf(actor.userId),
        sql`${conversations.lastMessageAt} > ${myLastReadAt(actor.userId)}`,
        sql`${latestSenderId} is distinct from ${actor.userId}`,
      ),
    );
  return row.n;
}

type ThreadListingRow = {
  id: string;
  title: string;
  schoolSlug: string;
  coverPath: string | null;
  address: string;
  unit: string | null;
};

export function toThreadListing(
  row: ThreadListingRow,
  unit: string | null,
  linkable: boolean,
): ThreadListing {
  return {
    id: row.id,
    title: row.title,
    schoolSlug: row.schoolSlug,
    coverThumbUrl: row.coverPath ? photoUrls(row.coverPath).thumb : null,
    address: row.address,
    unit,
    linkable,
  };
}

async function fetchMessages(
  conversationId: string,
  before: string | null,
): Promise<{ messages: MessageView[]; hasEarlier: boolean }> {
  const cursor =
    before === null
      ? undefined
      : sql`(${messages.createdAt}, ${messages.id}) < (select m.created_at, m.id from ${messages} m where m.id = ${before})`;
  const rows = await db()
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), cursor))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(THREAD_PAGE_SIZE + 1);
  return {
    messages: rows.slice(0, THREAD_PAGE_SIZE).reverse().map(toMessageView),
    hasEarlier: rows.length > THREAD_PAGE_SIZE,
  };
}

export async function getThread(actor: Actor, conversationId: string): Promise<ThreadView> {
  const user = requireUser(actor);
  if (!isUuid(conversationId)) throw conversationNotFound();
  const [row] = await db()
    .select({
      conversation: conversations,
      listingId: listings.id,
      title: listings.title,
      schoolSlug: schools.slug,
      coverPath: listingPhotos.storagePath,
      address: listings.address,
      unit: listings.unit,
      ownerId: listings.ownerId,
      isPublic: sql<boolean>`coalesce(${isPublicListing}, false)`,
    })
    .from(conversations)
    .leftJoin(listings, eq(listings.id, conversations.listingId))
    .leftJoin(schools, eq(schools.id, listings.schoolId))
    .leftJoin(users, eq(users.id, listings.ownerId))
    .leftJoin(listingPhotos, coverJoin)
    .where(and(eq(conversations.id, conversationId), isParticipantOf(user.userId)));
  if (!row) throw conversationNotFound();

  const { conversation } = row;
  const otherId = conversation.hostId === user.userId ? conversation.renterId : conversation.hostId;
  const [other] = otherId
    ? await db()
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, otherId))
    : [];
  const block = other ? await getBlockState(user.userId, other.id) : null;
  const blocked = block !== null && (block.viewerBlocked || block.blockedByOther);
  const page = await fetchMessages(conversation.id, null);

  return {
    id: conversation.id,
    viewerId: user.userId,
    listing:
      row.listingId && row.title !== null && row.schoolSlug !== null && row.address !== null
        ? toThreadListing(
            {
              id: row.listingId,
              title: row.title,
              schoolSlug: row.schoolSlug,
              coverPath: row.coverPath,
              address: row.address,
              unit: row.unit,
            },
            row.unit,
            row.ownerId === user.userId || (row.isPublic && !blocked),
          )
        : null,
    otherUser: other ?? null,
    composer:
      other && block ? await composerStateWithBlock(user.userId, other.id, block) : 'deleted_user',
    ...page,
  };
}

export async function listEarlierMessages(
  actor: Actor,
  input: unknown,
): Promise<{ messages: MessageView[]; hasEarlier: boolean }> {
  const user = requireUser(actor);
  let parsed: { conversationId: string; before: string };
  try {
    parsed = parseInput(earlierMessagesSchema, input);
  } catch (error) {
    if (error instanceof ValidationError) throw conversationNotFound();
    throw error;
  }
  const [conversation] = await db()
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, parsed.conversationId), isParticipantOf(user.userId)));
  if (!conversation) throw conversationNotFound();
  const [anchor] = await db()
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.id, parsed.before), eq(messages.conversationId, conversation.id)));
  if (!anchor) throw conversationNotFound();
  return fetchMessages(conversation.id, anchor.id);
}

export async function getConversationStart(
  actor: Actor,
  listingId: string,
): Promise<ConversationStart> {
  const user = requireUser(actor);
  const notFound = (): NotFound => new NotFound('Listing not found');
  if (!isUuid(listingId)) throw notFound();
  const [row] = await db()
    .select({
      id: listings.id,
      title: listings.title,
      schoolSlug: schools.slug,
      coverPath: listingPhotos.storagePath,
      address: listings.address,
      unit: listings.unit,
      hostId: users.id,
      hostName: users.displayName,
    })
    .from(listings)
    .innerJoin(schools, eq(schools.id, listings.schoolId))
    .innerJoin(users, eq(users.id, listings.ownerId))
    .leftJoin(listingPhotos, coverJoin)
    .where(
      and(
        eq(listings.id, listingId),
        isPublicListing,
        ne(listings.ownerId, user.userId),
        noBlockWith(user.userId),
      ),
    );
  if (!row) throw notFound();
  const [existing] = await db()
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.listingId, listingId), eq(conversations.renterId, user.userId)));
  return {
    existingConversationId: existing?.id ?? null,
    listing: toThreadListing(row, null, true),
    host: { id: row.hostId, displayName: row.hostName },
  };
}
