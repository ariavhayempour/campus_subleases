import { Forbidden } from './errors';

export type UserActor = { kind: 'user'; userId: string; isAdmin: boolean };
export type Actor = { kind: 'anonymous'; ip?: string } | UserActor;

export const ANONYMOUS: Actor = { kind: 'anonymous' };

export function requireUser(actor: Actor): UserActor {
  if (actor.kind !== 'user') throw new Forbidden('Sign in required');
  return actor;
}

export function requireAdmin(actor: Actor): UserActor {
  const user = requireUser(actor);
  if (!user.isAdmin) throw new Forbidden('Admins only');
  return user;
}
