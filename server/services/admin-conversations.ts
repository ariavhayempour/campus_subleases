import { desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ADMIN_THREAD_LIMIT } from '@/lib/moderation-options';
import type { MessageView } from '@/lib/messaging-options';
import { isUuid } from '@/lib/validation/listing';
import { db, type DbExecutor } from '@/server/db/client';
import {
  conversations,
  listingPhotos,
  listings,
  messages,
  schools,
  users,
} from '@/server/db/schema';
import { requireAdmin, type Actor } from './actor';
import { writeAudit } from './audit';
import { NotFound } from './errors';
import { coverJoin } from './listing-cards';
import { toMessageView } from './messaging';
import { toThreadListing, type Participant, type ThreadListing } from './messaging-reads';

export type AdminConversationView = {
  id: string;
  createdAt: Date;
  listing: ThreadListing | null;
  host: Participant | null;
  renter: Participant | null;
  messages: MessageView[]; // oldest first, latest ADMIN_THREAD_LIMIT
  truncated: boolean;
};

// Admin services only (callers check requireAdmin); logs one view per call.
export async function loadAdminConversation(
  executor: DbExecutor,
  conversationId: string,
  adminId: string,
): Promise<AdminConversationView | null> {
  if (!isUuid(conversationId)) return null;
  const host = alias(users, 'host');
  const renter = alias(users, 'renter');
  const [row] = await executor
    .select({
      id: conversations.id,
      createdAt: conversations.createdAt,
      listingId: listings.id,
      title: listings.title,
      schoolSlug: schools.slug,
      coverPath: listingPhotos.storagePath,
      address: listings.address,
      unit: listings.unit,
      hostId: host.id,
      hostName: host.displayName,
      renterId: renter.id,
      renterName: renter.displayName,
    })
    .from(conversations)
    .leftJoin(listings, eq(listings.id, conversations.listingId))
    .leftJoin(schools, eq(schools.id, listings.schoolId))
    .leftJoin(listingPhotos, coverJoin)
    .leftJoin(host, eq(host.id, conversations.hostId))
    .leftJoin(renter, eq(renter.id, conversations.renterId))
    .where(eq(conversations.id, conversationId));
  if (!row) return null;

  const rows = await executor
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(ADMIN_THREAD_LIMIT + 1);
  await writeAudit(executor, {
    adminId,
    action: 'viewed_conversation',
    targetType: 'conversation',
    targetId: conversationId,
  });

  return {
    id: row.id,
    createdAt: row.createdAt,
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
            true,
          )
        : null,
    host: row.hostId ? { id: row.hostId, displayName: row.hostName ?? '' } : null,
    renter: row.renterId ? { id: row.renterId, displayName: row.renterName ?? '' } : null,
    messages: rows.slice(0, ADMIN_THREAD_LIMIT).reverse().map(toMessageView),
    truncated: rows.length > ADMIN_THREAD_LIMIT,
  };
}

export async function getAdminConversation(
  actor: Actor,
  conversationId: string,
): Promise<AdminConversationView> {
  const admin = requireAdmin(actor);
  const view = await db().transaction((tx) =>
    loadAdminConversation(tx, conversationId, admin.userId),
  );
  if (!view) throw new NotFound('Conversation not found');
  return view;
}
