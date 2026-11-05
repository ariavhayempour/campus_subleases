import { and, eq, or } from 'drizzle-orm';
import { blockInputSchema } from '@/lib/validation/messaging';
import { db, type DbExecutor } from '@/server/db/client';
import { blocks } from '@/server/db/schema';
import { requireUser, type Actor } from './actor';
import { NotFound, parseInput, ValidationError } from './errors';
import { lockMessagingUsers } from './locks';

export type BlockState = { viewerBlocked: boolean; blockedByOther: boolean };

export async function blockUser(actor: Actor, input: unknown): Promise<void> {
  const user = requireUser(actor);
  const { userId } = parseInput(blockInputSchema, input);
  if (userId === user.userId) {
    throw new ValidationError({ userId: ["You can't block yourself"] });
  }
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

// Drivers may wrap the Postgres error, so walk the cause chain.
function hasPgCode(error: unknown, code: string): boolean {
  let current: unknown = error;
  for (let depth = 0; current && typeof current === 'object' && depth < 5; depth += 1) {
    if ((current as { code?: unknown }).code === code) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export async function unblockUser(actor: Actor, input: unknown): Promise<void> {
  const user = requireUser(actor);
  const { userId } = parseInput(blockInputSchema, input);
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
