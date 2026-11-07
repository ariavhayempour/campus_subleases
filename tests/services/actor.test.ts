import { ClerkAPIResponseError } from '@clerk/nextjs/errors';
import { auth, currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { getActor } from '@/server/auth/get-actor';
import { ANONYMOUS, requireAdmin, requireUser, type UserActor } from '@/server/services/actor';
import { Forbidden } from '@/server/services/errors';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn(), currentUser: vi.fn() }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '203.0.113.9' }),
}));

const signedOut = { kind: 'anonymous', ip: '203.0.113.9' };

const member: UserActor = { kind: 'user', userId: 'user_1', isAdmin: false };
const admin: UserActor = { kind: 'user', userId: 'user_2', isAdmin: true };

describe('actor guards', () => {
  it('requireUser rejects anonymous actors', () => {
    expect(() => requireUser(ANONYMOUS)).toThrow(Forbidden);
    expect(requireUser(member)).toBe(member);
  });

  it('requireAdmin rejects non-admins', () => {
    expect(() => requireAdmin(ANONYMOUS)).toThrow(Forbidden);
    expect(() => requireAdmin(member)).toThrow(Forbidden);
    expect(requireAdmin(admin)).toBe(admin);
  });
});

describe('getActor for a deleted user', () => {
  const deletedId = `user_deleted_${crypto.randomUUID().replaceAll('-', '')}`;

  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(currentUser).mockReset();
    vi.mocked(auth).mockResolvedValue({
      userId: deletedId,
      sessionClaims: { metadata: { role: 'admin' } },
    } as unknown as Awaited<ReturnType<typeof auth>>);
  });

  async function userRow() {
    return db().select().from(users).where(eq(users.id, deletedId));
  }

  it('returns anonymous when the users row is gone and Clerk has no account', async () => {
    vi.mocked(currentUser).mockResolvedValue(null);
    await expect(getActor()).resolves.toEqual(signedOut);
    expect(currentUser).toHaveBeenCalledOnce();
    expect(await userRow()).toHaveLength(0);
  });

  it('returns anonymous when Clerk answers 404 for the account', async () => {
    vi.mocked(currentUser).mockRejectedValue(
      new ClerkAPIResponseError('Not Found', { data: [], status: 404 }),
    );
    await expect(getActor()).resolves.toEqual(signedOut);
    expect(await userRow()).toHaveLength(0);
  });
});

describe('getActor when signed out', () => {
  it('returns an anonymous actor carrying the client IP', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as unknown as Awaited<
      ReturnType<typeof auth>
    >);
    await expect(getActor()).resolves.toEqual(signedOut);
  });
});
