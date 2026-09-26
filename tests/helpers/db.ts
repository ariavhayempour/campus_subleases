import { db, rootDb, withDbScope } from '@/server/db/client';

class Rollback extends Error {}

// Runs fn inside a transaction that is always rolled back; db() resolves to it.
export async function withRollback(fn: () => Promise<void>): Promise<void> {
  try {
    await rootDb().transaction(async (tx) => {
      await withDbScope(tx, fn);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    parts.push(current.message);
    current = current.cause;
  }
  return parts.join(' | ');
}

// Runs fn in a savepoint so a failing statement does not abort the surrounding test transaction.
export async function catchDbError(fn: () => Promise<unknown>): Promise<string> {
  try {
    await db().transaction(async (tx) => {
      await withDbScope(tx, fn);
    });
  } catch (error) {
    return describeError(error);
  }
  throw new Error('Expected a database error');
}
