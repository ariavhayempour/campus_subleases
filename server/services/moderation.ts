import { and, eq, or } from 'drizzle-orm';
import { blockInputSchema } from '@/lib/validation/messaging';
import { db } from '@/server/db/client';
import { blocks, users } from '@/server/db/schema';
import { requireUser, type Actor } from './actor';
import { NotFound, parseInput, ValidationError } from './errors';

export type BlockState = { viewerBlocked: boolean; blockedByOther: boolean };

export async function blockUser(actor: Actor, input: unknown): Promise<void> {
  const user = requireUser(actor);
  const { userId } = parseInput(blockInputSchema, input);
  if (userId === user.userId) {
    throw new ValidationError({ userId: ["You can't block yourself"] });
  }
  const [target] = await db().select({ id: users.id }).from(users).where(eq(users.id, userId));
  if (!target) throw new NotFound('User not found');
  await db()
    .insert(blocks)
    .values({ blockerId: user.userId, blockedId: userId })
    .onConflictDoNothing();
}

export async function unblockUser(actor: Actor, input: unknown): Promise<void> {
  const user = requireUser(actor);
  const { userId } = parseInput(blockInputSchema, input);
  await db()
    .delete(blocks)
    .where(and(eq(blocks.blockerId, user.userId), eq(blocks.blockedId, userId)));
}

export async function getBlockState(viewerId: string, otherId: string): Promise<BlockState> {
  const rows = await db()
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
