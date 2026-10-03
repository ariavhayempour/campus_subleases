'use server';

import { revalidatePath } from 'next/cache';
import { runAction, type ActionResult } from '@/app/_lib/action-result';
import type { ListingStatus } from '@/lib/listing-options';
import { getActor } from '@/server/auth/get-actor';
import { deleteListing, setListingStatus } from '@/server/services/listings';

export async function setListingStatusAction(
  listingId: string,
  status: ListingStatus,
): Promise<ActionResult<void>> {
  const actor = await getActor();
  const result = await runAction(() => setListingStatus(actor, { listingId, status }));
  if (result.ok) revalidatePath('/me/listings');
  return result;
}

export async function deleteListingAction(listingId: string): Promise<ActionResult<void>> {
  const actor = await getActor();
  const result = await runAction(() => deleteListing(actor, listingId));
  if (result.ok) revalidatePath('/me/listings');
  return result;
}
