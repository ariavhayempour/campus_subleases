import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { getActor } from '@/server/auth/get-actor';
import type { UserActor } from '@/server/services/actor';
import { NotFound } from '@/server/services/errors';
import { getOnboardingState } from '@/server/services/users';

export async function requireSignedIn(): Promise<UserActor> {
  const actor = await getActor();
  if (actor.kind === 'user') return actor;
  const { redirectToSignIn } = await auth();
  return redirectToSignIn();
}

export async function requireOnboardedUser(): Promise<UserActor> {
  const actor = await requireSignedIn();
  if ((await getOnboardingState(actor)).needsOnboarding) redirect('/onboarding');
  return actor;
}

export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof NotFound) notFound();
    throw error;
  }
}
