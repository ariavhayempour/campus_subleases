import { auth, currentUser } from '@clerk/nextjs/server';
import * as Sentry from '@sentry/nextjs';
import { cache } from 'react';
import type { Actor } from '@/server/services/actor';
import { ensureUser, getUserById } from '@/server/services/users';

export const getActor = cache(async (): Promise<Actor> => {
  const { userId, sessionClaims } = await auth();
  if (!userId) return { kind: 'anonymous' };
  if (!(await getUserById(userId))) {
    const clerkUser = await currentUser();
    await ensureUser({
      id: userId,
      firstName: clerkUser?.firstName ?? null,
      lastName: clerkUser?.lastName ?? null,
    });
  }
  Sentry.setUser({ id: userId });
  return { kind: 'user', userId, isAdmin: sessionClaims?.metadata?.role === 'admin' };
});
