'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { runAction, type ActionResult } from '@/app/_lib/action-result';
import { getActor } from '@/server/auth/get-actor';
import {
  approveListing,
  deleteListingAsAdmin,
  hideListing,
  rejectListing,
  unhideListing,
} from '@/server/services/admin-listings';

// The listing's school slug is not known here, so refresh every public listing page.
function revalidateDecision(): void {
  revalidatePath('/admin', 'layout');
  revalidatePath('/[school]/listings/[id]', 'page');
  revalidatePath('/me/listings');
}

async function decide(run: () => Promise<void>): Promise<ActionResult<void>> {
  const result = await runAction(run);
  if (result.ok) revalidateDecision();
  return result;
}

export async function approveAction(
  listingId: string,
  version: string,
): Promise<ActionResult<void>> {
  const actor = await getActor();
  return decide(() => approveListing(actor, { listingId, version }));
}

export async function rejectAction(
  listingId: string,
  version: string,
  note: string,
): Promise<ActionResult<void>> {
  const actor = await getActor();
  return decide(() => rejectListing(actor, { listingId, version, note }));
}

export async function hideAction(listingId: string): Promise<ActionResult<void>> {
  const actor = await getActor();
  return decide(() => hideListing(actor, { listingId }));
}

export async function unhideAction(listingId: string): Promise<ActionResult<void>> {
  const actor = await getActor();
  return decide(() => unhideListing(actor, { listingId }));
}

export async function deleteListingAction(
  listingId: string,
  confirm: string,
): Promise<ActionResult<void>> {
  const actor = await getActor();
  const result = await decide(() => deleteListingAsAdmin(actor, { listingId, confirm }));
  // redirect() throws, so it stays outside runAction.
  if (result.ok) redirect('/admin/listings');
  return result;
}
