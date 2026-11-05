'use server';

import { revalidatePath } from 'next/cache';
import { runAction, type ActionResult } from '@/app/_lib/action-result';
import { getActor } from '@/server/auth/get-actor';
import { resolveReport } from '@/server/services/admin-reports';

export async function resolveReportAction(input: {
  reportId: string;
  note: string;
}): Promise<ActionResult<void>> {
  const actor = await getActor();
  const result = await runAction(() => resolveReport(actor, input));
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}
