'use server';

import { revalidatePath } from 'next/cache';
import { runAction, type ActionResult } from '@/app/_lib/action-result';
import type { MessageView } from '@/lib/messaging-options';
import { getActor } from '@/server/auth/get-actor';
import { blockUser, unblockUser } from '@/server/services/moderation';
import { markConversationRead, sendMessage, startConversation } from '@/server/services/messaging';
import { getUnreadCount, listEarlierMessages } from '@/server/services/messaging-reads';

function revalidateMessages<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) revalidatePath('/messages', 'layout');
  return result;
}

export async function startConversationAction(
  listingId: string,
  body: string,
): Promise<ActionResult<{ conversationId: string }>> {
  const actor = await getActor();
  return revalidateMessages(
    await runAction(async () => {
      const { conversationId } = await startConversation(actor, { listingId, body });
      return { conversationId };
    }),
  );
}

export async function sendMessageAction(
  conversationId: string,
  body: string,
): Promise<ActionResult<MessageView>> {
  const actor = await getActor();
  return revalidateMessages(
    await runAction(async () => (await sendMessage(actor, { conversationId, body })).message),
  );
}

export async function markReadAction(conversationId: string): Promise<ActionResult<void>> {
  const actor = await getActor();
  return revalidateMessages(await runAction(() => markConversationRead(actor, conversationId)));
}

export async function loadEarlierMessagesAction(
  conversationId: string,
  before: string,
): Promise<ActionResult<{ messages: MessageView[]; hasEarlier: boolean }>> {
  const actor = await getActor();
  return runAction(() => listEarlierMessages(actor, { conversationId, before }));
}

export async function blockUserAction(userId: string): Promise<ActionResult<void>> {
  const actor = await getActor();
  return revalidateMessages(await runAction(() => blockUser(actor, { userId })));
}

export async function unblockUserAction(userId: string): Promise<ActionResult<void>> {
  const actor = await getActor();
  return revalidateMessages(await runAction(() => unblockUser(actor, { userId })));
}

export async function getUnreadCountAction(): Promise<number> {
  return getUnreadCount(await getActor());
}
