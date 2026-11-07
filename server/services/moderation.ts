import { and, desc, eq, or } from 'drizzle-orm';
import { blockInputSchema } from '@/lib/validation/messaging';
import { db, type DbExecutor } from '@/server/db/client';
import { blocks, users } from '@/server/db/schema';
import { requireUser, type Actor } from './actor';
import { NotFound, parseInput, ValidationError } from './errors';
import { lockMessagingUsers } from './locks';
import { hasPgCode } from './pg-errors';
import { consume, RATE_LIMITS } from './rate-limit';

export type BlockState = { viewerBlocked: boolean; blockedByOther: boolean };

export async function blockUser(actor: Actor, input: unknown): Promise<void> {
  const user = requireUser(actor);
  const { userId } = parseInput(blockInputSchema, input);
  if (userId === user.userId) {
    throw new ValidationError({ userId: ["You can't block yourself"] });
  }
  await consume(RATE_LIMITS.blocks, user.userId);
  try {
    await db().transaction(async (tx) => {
      await lockMessagingUsers(tx, [user.userId, userId]);
      await tx
        .insert(blocks)
        .values({ blockerId: user.userId, blockedId: userId })
        .onConflictDoNothing();
    });
  } catch (error) {
    if (hasPgCode(error, '23503')) throw new NotFound('User not found');
    throw error;
  }
}

export async function unblockUser(actor: Actor, input: unknown): Promise<void> {
  const user = requireUser(actor);
  const { userId } = parseInput(blockInputSchema, input);
  await consume(RATE_LIMITS.blocks, user.userId);
  await db()
    .delete(blocks)
    .where(and(eq(blocks.blockerId, user.userId), eq(blocks.blockedId, userId)));
}

export async function getBlockState(
  viewerId: string,
  otherId: string,
  executor: DbExecutor = db(),
): Promise<BlockState> {
  const rows = await executor
    .select({ blockerId: blocks.blockerId })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, viewerId), eq(blocks.blockedId, otherId)),
        and(eq(blocks.blockerId, otherId), eq(blocks.blockedId, viewerId)),
      ),
    );
  return {
    viewerBlocked: rows.some((row) => row.blockerId === viewerId),
    blockedByOther: rows.some((row) => row.blockerId === otherId),
  };
}

export type BlockedUser = { id: string; displayName: string; blockedAt: Date };

export async function listBlockedUsers(actor: Actor): Promise<BlockedUser[]> {
  const user = requireUser(actor);
  return db()
    .select({ id: users.id, displayName: users.displayName, blockedAt: blocks.createdAt })
    .from(blocks)
    .innerJoin(users, eq(users.id, blocks.blockedId))
    .where(eq(blocks.blockerId, user.userId))
    .orderBy(desc(blocks.createdAt));
}
