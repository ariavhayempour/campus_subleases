import { sql } from 'drizzle-orm';
import type { DbExecutor } from '@/server/db/client';

// Sorted, distinct ids so two callers locking the same pair can never deadlock.
export async function lockMessagingUsers(executor: DbExecutor, userIds: string[]): Promise<void> {
  for (const id of [...new Set(userIds)].sort()) {
    await executor.execute(sql`select pg_advisory_xact_lock(hashtext('messaging:' || ${id}))`);
  }
}
