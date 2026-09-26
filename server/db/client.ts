import { AsyncLocalStorage } from 'node:async_hooks';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { serverEnv } from '@/lib/env';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type DbExecutor = Database | Transaction;

type DbGlobals = { sql?: postgres.Sql; database?: Database };
const globals = globalThis as typeof globalThis & { __wiscLeaseDb?: DbGlobals };
const scope = new AsyncLocalStorage<DbExecutor>();

export function rootDb(): Database {
  const state = (globals.__wiscLeaseDb ??= {});
  if (!state.database) {
    // prepare: false is required by Supabase's transaction pooler.
    state.sql = postgres(serverEnv().DATABASE_URL, { prepare: false, onnotice: () => {} });
    state.database = drizzle(state.sql, { schema });
  }
  return state.database;
}

export function db(): DbExecutor {
  return scope.getStore() ?? rootDb();
}

export function withDbScope<T>(executor: DbExecutor, fn: () => Promise<T>): Promise<T> {
  return scope.run(executor, fn);
}

export async function closeDb(): Promise<void> {
  const state = globals.__wiscLeaseDb;
  if (state?.sql) await state.sql.end();
  globals.__wiscLeaseDb = undefined;
}
