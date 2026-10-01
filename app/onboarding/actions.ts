'use server';

import { redirect } from 'next/navigation';
import { runAction, type ActionResult } from '@/app/_lib/action-result';
import type { OnboardingInput } from '@/lib/validation/onboarding';
import { getActor } from '@/server/auth/get-actor';
import { completeOnboarding } from '@/server/services/users';

export async function completeOnboardingAction(
  input: OnboardingInput,
): Promise<ActionResult<void>> {
  const actor = await getActor();
  const result = await runAction(() => completeOnboarding(actor, input));
  if (!result.ok) return result;
  redirect(`/${result.data.schoolSlug}`);
}
