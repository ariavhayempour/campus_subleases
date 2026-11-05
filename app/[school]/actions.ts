'use server';

import { runAction, type ActionResult } from '@/app/_lib/action-result';
import { parseSearchParams, searchParamsToRecord } from '@/lib/validation/search';
import { getActor } from '@/server/auth/get-actor';
import { searchListings, type SearchPage } from '@/server/services/search';

export async function loadMoreListingsAction(
  schoolId: string,
  query: string,
  offset: number,
): Promise<ActionResult<SearchPage>> {
  const actor = await getActor();
  const filters = parseSearchParams(searchParamsToRecord(new URLSearchParams(query)));
  return runAction(() => searchListings(actor, { schoolId, filters, offset }));
}
