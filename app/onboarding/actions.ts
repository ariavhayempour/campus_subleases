'use server';

import { redirect } from 'next/navigation';
import { runAction, type ActionResult } from '@/app/_lib/action-result';
import { safeReturnPath } from '@/lib/return-path';
import type { OnboardingInput } from '@/lib/validation/onboarding';
import { getActor } from '@/server/auth/get-actor';
import { completeOnboarding } from '@/server/services/users';

export async function completeOnboardingAction(
  input: OnboardingInput,
  returnPath: string | null = null,
): Promise<ActionResult<void>> {
  const actor = await getActor();
  const result = await runAction(() => completeOnboarding(actor, input));
  if (!result.ok) return result;
  // Re-checked here because action arguments come from the client.
  redirect(safeReturnPath(returnPath) ?? `/${result.data.schoolSlug}`);
}
