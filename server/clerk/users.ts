import { clerkClient } from '@clerk/nextjs/server';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';

export type ClerkAccount = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  banned: boolean;
  isAdmin: boolean;
};

type ClerkUserLike = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  banned: boolean;
  publicMetadata: Record<string, unknown>;
};

const toAccount = (user: ClerkUserLike): ClerkAccount => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  banned: user.banned,
  isAdmin: user.publicMetadata.role === 'admin',
});

const isNotFound = (error: unknown): boolean =>
  isClerkAPIResponseError(error) && error.status === 404;

export async function getClerkAccount(userId: string): Promise<ClerkAccount | null> {
  const client = await clerkClient();
  try {
    return toAccount(await client.users.getUser(userId));
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function setClerkBan(userId: string, banned: boolean): Promise<ClerkAccount> {
  const client = await clerkClient();
  const user = banned ? await client.users.banUser(userId) : await client.users.unbanUser(userId);
  return toAccount(user);
}

// A 404 means the account is already gone, so local cleanup can still finish.
export async function deleteClerkAccount(userId: string): Promise<void> {
  const client = await clerkClient();
  try {
    await client.users.deleteUser(userId);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}
