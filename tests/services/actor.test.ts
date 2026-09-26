import { describe, expect, it } from 'vitest';
import { ANONYMOUS, requireAdmin, requireUser, type UserActor } from '@/server/services/actor';
import { Forbidden } from '@/server/services/errors';

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
