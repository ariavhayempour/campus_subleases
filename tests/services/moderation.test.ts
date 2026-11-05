import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/server/db/client';
import { blocks } from '@/server/db/schema';
import { ANONYMOUS } from '@/server/services/actor';
import { Forbidden, NotFound } from '@/server/services/errors';
import {
  blockUser,
  getBlockState,
  listBlockedUsers,
  unblockUser,
} from '@/server/services/moderation';
import { withRollback } from '../helpers/db';
import { actorFor, createUser } from '../helpers/fixtures';

describe('moderation', () => {
  it('blocks and unblocks idempotently', () =>
    withRollback(async () => {
      const me = await createUser();
      const other = await createUser();
      await blockUser(actorFor(me.id), { userId: other.id });
      await blockUser(actorFor(me.id), { userId: other.id });
      const rows = await db().select().from(blocks).where(eq(blocks.blockerId, me.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.blockedId).toBe(other.id);
      await unblockUser(actorFor(me.id), { userId: other.id });
      await unblockUser(actorFor(me.id), { userId: other.id });
      expect(await db().select().from(blocks).where(eq(blocks.blockerId, me.id))).toHaveLength(0);
    }));

  it('reports the direction of a block', () =>
    withRollback(async () => {
      const me = await createUser();
      const other = await createUser();
      await blockUser(actorFor(me.id), { userId: other.id });
      expect(await getBlockState(me.id, other.id)).toEqual({
        viewerBlocked: true,
        blockedByOther: false,
      });
      expect(await getBlockState(other.id, me.id)).toEqual({
        viewerBlocked: false,
        blockedByOther: true,
      });
    }));

  it('unblocking removes only my own block', () =>
    withRollback(async () => {
      const me = await createUser();
      const other = await createUser();
      await blockUser(actorFor(me.id), { userId: other.id });
      await blockUser(actorFor(other.id), { userId: me.id });
      await unblockUser(actorFor(me.id), { userId: other.id });
      expect(await getBlockState(me.id, other.id)).toEqual({
        viewerBlocked: false,
        blockedByOther: true,
      });
    }));

  it('rejects blocking yourself', () =>
    withRollback(async () => {
      const me = await createUser();
      await expect(blockUser(actorFor(me.id), { userId: me.id })).rejects.toMatchObject({
        code: 'ValidationError',
        fieldErrors: { userId: ["You can't block yourself"] },
      });
    }));

  it('rejects blocking a user who does not exist', () =>
    withRollback(async () => {
      const me = await createUser();
      await expect(blockUser(actorFor(me.id), { userId: 'user_missing' })).rejects.toMatchObject({
        message: 'User not found',
      });
      await expect(blockUser(actorFor(me.id), { userId: 'user_missing' })).rejects.toBeInstanceOf(
        NotFound,
      );
    }));

  it('requires sign-in', () =>
    withRollback(async () => {
      await expect(blockUser(ANONYMOUS, { userId: 'user_x' })).rejects.toBeInstanceOf(Forbidden);
      await expect(unblockUser(ANONYMOUS, { userId: 'user_x' })).rejects.toBeInstanceOf(Forbidden);
    }));

  it('listBlockedUsers returns my blocks, newest first', () =>
    withRollback(async () => {
      const me = await createUser();
      const older = await createUser({ displayName: 'Older O.' });
      const newer = await createUser({ displayName: 'Newer N.' });
      await db()
        .insert(blocks)
        .values([
          { blockerId: me.id, blockedId: older.id, createdAt: new Date('2026-01-01T00:00:00Z') },
          { blockerId: me.id, blockedId: newer.id, createdAt: new Date('2026-02-01T00:00:00Z') },
        ]);
      const list = await listBlockedUsers(actorFor(me.id));
      expect(list.map((row) => [row.id, row.displayName])).toEqual([
        [newer.id, 'Newer N.'],
        [older.id, 'Older O.'],
      ]);
      expect(list[0]?.blockedAt).toBeInstanceOf(Date);
    }));
});
