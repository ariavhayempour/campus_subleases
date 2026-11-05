import { deleteAccountSchema } from '@/lib/validation/moderation';
import { deleteClerkAccount } from '@/server/clerk/users';
import { requireUser, type Actor } from './actor';
import { parseInput } from './errors';
import { deleteUserFromClerk } from './users';

// Clerk goes first so a failure leaves the local account intact and retryable.
export async function deleteAccount(actor: Actor, input: unknown): Promise<void> {
  const user = requireUser(actor);
  parseInput(deleteAccountSchema, input);
  await deleteClerkAccount(user.userId);
  await deleteUserFromClerk(user.userId);
}
