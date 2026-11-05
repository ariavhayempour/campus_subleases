'use server';

import { revalidatePath } from 'next/cache';
import { runAction, type ActionResult } from '@/app/_lib/action-result';
import type { ReportTargetType } from '@/lib/moderation-options';
import { getActor } from '@/server/auth/get-actor';
import { createReport } from '@/server/services/reports';

export type ReportActionInput = {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
};

export async function reportAction(
  input: ReportActionInput,
): Promise<ActionResult<{ id: string; autoHidden: boolean }>> {
  const actor = await getActor();
  const result = await runAction(() => createReport(actor, input));
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}
