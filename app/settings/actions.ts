'use server';

import { revalidatePath } from 'next/cache';
import { runAction, type ActionResult } from '@/app/_lib/action-result';
import { getActor } from '@/server/auth/get-actor';
import { deleteAccount } from '@/server/services/account';
import { unblockUser } from '@/server/services/moderation';

export async function unblockFromSettingsAction(userId: string): Promise<ActionResult<void>> {
  const actor = await getActor();
  const result = await runAction(() => unblockUser(actor, { userId }));
  if (result.ok) {
    revalidatePath('/settings');
    revalidatePath('/messages', 'layout');
  }
  return result;
}

export async function deleteAccountAction(input: { confirm: string }): Promise<ActionResult<void>> {
  const actor = await getActor();
  // No revalidation: re-rendering as the just-deleted user would hit a missing Clerk account.
  return runAction(() => deleteAccount(actor, input));
}
