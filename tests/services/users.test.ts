import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/server/db/client';
import { schools } from '@/server/db/schema';
import { ANONYMOUS, type UserActor } from '@/server/services/actor';
import { Forbidden, ValidationError } from '@/server/services/errors';
import {
  completeOnboarding,
  deleteUserFromClerk,
  ensureUser,
  getOnboardingState,
  getUserById,
  syncUserFromClerk,
} from '@/server/services/users';
import { withRollback } from '../helpers/db';
import { createSchool, createUser } from '../helpers/fixtures';

const actorFor = (userId: string): UserActor => ({ kind: 'user', userId, isAdmin: false });
const seededId = async (slug: string): Promise<string> =>
  (await db().select({ id: schools.id }).from(schools).where(eq(schools.slug, slug)))[0].id;

describe('Clerk sync', () => {
  it('creates, updates, and bans idempotently', () =>
    withRollback(async () => {
      await syncUserFromClerk({
        id: 'user_sync',
        firstName: 'Ada',
        lastName: 'Lovelace',
        banned: false,
      });
      await syncUserFromClerk({
        id: 'user_sync',
        firstName: 'Ada',
        lastName: 'Lovelace',
        banned: false,
      });
      await syncUserFromClerk({
        id: 'user_sync',
        firstName: 'Ada',
        lastName: 'Byron',
        banned: true,
      });
      const row = await getUserById('user_sync');
      expect(row).toMatchObject({
        firstName: 'Ada',
        lastName: 'Byron',
        displayName: 'Ada B.',
        status: 'banned',
      });
    }));

  it('does not overwrite the home school on update', () =>
    withRollback(async () => {
      const user = await createUser({ homeSchoolId: await seededId('ucla') });
      await syncUserFromClerk({
        id: user.id,
        firstName: 'Grace',
        lastName: 'Hopper',
        banned: false,
      });
      expect(await getUserById(user.id)).toMatchObject({
        displayName: 'Grace H.',
        homeSchoolId: user.homeSchoolId,
      });
    }));

  it('deletes idempotently', () =>
    withRollback(async () => {
      const user = await createUser();
      await deleteUserFromClerk(user.id);
      await deleteUserFromClerk(user.id);
      expect(await getUserById(user.id)).toBeNull();
    }));
});

describe('ensureUser', () => {
  it('creates a missing user and leaves an existing one untouched', () =>
    withRollback(async () => {
      const created = await ensureUser({ id: 'user_lazy', firstName: 'Alan', lastName: 'Turing' });
      expect(created).toMatchObject({
        id: 'user_lazy',
        firstName: 'Alan',
        lastName: 'Turing',
        displayName: 'Alan T.',
        homeSchoolId: null,
        status: 'active',
      });
      const existing = await createUser({ displayName: 'Grace H.' });
      const again = await ensureUser({ id: existing.id, firstName: 'Ignored', lastName: 'Name' });
      expect(again).toMatchObject({ firstName: existing.firstName, displayName: 'Grace H.' });
    }));
});

describe('onboarding', () => {
  it('requires a home school', () =>
    withRollback(async () => {
      const user = await createUser();
      expect(await getOnboardingState(actorFor(user.id))).toEqual({
        needsOnboarding: true,
        homeSchoolSlug: null,
      });
    }));

  it('completes onboarding and reports the home school slug', () =>
    withRollback(async () => {
      const user = await createUser();
      const result = await completeOnboarding(actorFor(user.id), {
        homeSchoolId: await seededId('umich'),
      });
      expect(result).toEqual({ schoolSlug: 'umich' });
      expect(await getOnboardingState(actorFor(user.id))).toEqual({
        needsOnboarding: false,
        homeSchoolSlug: 'umich',
      });
    }));

  it('rejects anonymous actors', async () => {
    await expect(completeOnboarding(ANONYMOUS, {})).rejects.toBeInstanceOf(Forbidden);
  });

  it('returns field errors for invalid input', () =>
    withRollback(async () => {
      const user = await createUser();
      const error = await completeOnboarding(actorFor(user.id), { homeSchoolId: 'x' }).catch(
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).fieldErrors).toEqual({
        homeSchoolId: ['Choose your school'],
      });
    }));

  it('rejects inactive schools', () =>
    withRollback(async () => {
      const user = await createUser();
      const closed = await createSchool({ isActive: false });
      const error = await completeOnboarding(actorFor(user.id), { homeSchoolId: closed.id }).catch(
        (e: unknown) => e,
      );
      expect((error as ValidationError).fieldErrors).toEqual({
        homeSchoolId: ['Choose your school'],
      });
    }));

  it('treats an inactive home school as having no home school slug', () =>
    withRollback(async () => {
      const closed = await createSchool({ isActive: false });
      const user = await createUser({ homeSchoolId: closed.id });
      expect(await getOnboardingState(actorFor(user.id))).toEqual({
        needsOnboarding: false,
        homeSchoolSlug: null,
      });
    }));
});
