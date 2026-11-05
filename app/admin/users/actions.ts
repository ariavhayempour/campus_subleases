'use server';

import { revalidatePath } from 'next/cache';
import { runAction, type ActionResult } from '@/app/_lib/action-result';
import { getActor } from '@/server/auth/get-actor';
import { banUser, unbanUser } from '@/server/services/admin-users';

async function change(run: () => Promise<void>): Promise<ActionResult<void>> {
  const result = await runAction(run);
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}

export async function banAction(userId: string): Promise<ActionResult<void>> {
  const actor = await getActor();
  return change(() => banUser(actor, { userId }));
}

export async function unbanAction(userId: string): Promise<ActionResult<void>> {
  const actor = await getActor();
  return change(() => unbanUser(actor, { userId }));
}
