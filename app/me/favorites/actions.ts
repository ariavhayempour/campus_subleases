'use server';

import { revalidatePath } from 'next/cache';
import { runAction, type ActionResult } from '@/app/_lib/action-result';
import { getActor } from '@/server/auth/get-actor';
import { setFavorite } from '@/server/services/favorites';

export async function setFavoriteAction(
  listingId: string,
  favorited: boolean,
): Promise<ActionResult<void>> {
  const actor = await getActor();
  const result = await runAction(() => setFavorite(actor, { listingId, favorited }));
  if (result.ok) revalidatePath('/me/favorites');
  return result;
}
