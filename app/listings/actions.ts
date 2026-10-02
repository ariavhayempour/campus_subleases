'use server';

import { redirect } from 'next/navigation';
import { runAction, type ActionResult } from '@/app/_lib/action-result';
import type { ListingInput, PhotoUploadRequest } from '@/lib/validation/listing';
import { getActor } from '@/server/auth/get-actor';
import { createListing, updateListing } from '@/server/services/listings';
import { requestPhotoUploads, type PhotoUploadTarget } from '@/server/services/photos';

export async function requestPhotoUploadsAction(
  input: PhotoUploadRequest,
): Promise<ActionResult<PhotoUploadTarget[]>> {
  const actor = await getActor();
  return runAction(() => requestPhotoUploads(actor, input));
}

export async function createListingAction(input: ListingInput): Promise<ActionResult<void>> {
  const actor = await getActor();
  const result = await runAction(() => createListing(actor, input));
  if (!result.ok) return result;
  redirect('/me/listings?notice=created');
}

export async function updateListingAction(
  listingId: string,
  input: ListingInput,
): Promise<ActionResult<void>> {
  const actor = await getActor();
  const result = await runAction(() => updateListing(actor, listingId, input));
  if (!result.ok) return result;
  redirect(`/me/listings?notice=${result.data.reviewStatus === 'pending' ? 'in-review' : 'saved'}`);
}
