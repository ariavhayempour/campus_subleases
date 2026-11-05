import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { conversations, messages } from '@/server/db/schema';
import { createSchool, createUser, insertListing } from './fixtures';

export async function liveListing(): Promise<{
  owner: Awaited<ReturnType<typeof createUser>>;
  school: Awaited<ReturnType<typeof createSchool>>;
  listing: Awaited<ReturnType<typeof insertListing>>;
}> {
  const owner = await createUser();
  const school = await createSchool();
  const listing = await insertListing(owner.id, school.id, { reviewStatus: 'approved' });
  return { owner, school, listing };
}

export async function insertConversation(values: {
  listingId: string | null;
  hostId: string | null;
  renterId: string | null;
  createdAt?: Date;
  lastMessageAt?: Date;
  hostLastReadAt?: Date;
  renterLastReadAt?: Date;
}): Promise<typeof conversations.$inferSelect> {
  const [row] = await db().insert(conversations).values(values).returning();
  return row;
}

export async function insertMessage(
  conversationId: string,
  senderId: string | null,
  body: string,
  createdAt?: Date,
): Promise<typeof messages.$inferSelect> {
  const [row] = await db()
    .insert(messages)
    .values({ conversationId, senderId, body, ...(createdAt ? { createdAt } : {}) })
    .returning();
  await db()
    .update(conversations)
    .set({ lastMessageAt: row.createdAt })
    .where(eq(conversations.id, conversationId));
  return row;
}
