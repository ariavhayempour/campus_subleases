import postgres from 'postgres';
import { LOCAL_DATABASE_URL } from '../../tests/local-db';

// The E2E users repeat hour-limited actions every run, so local reruns would otherwise trip them.
export async function resetRateLimits(): Promise<void> {
  const sql = postgres(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL, { max: 1, prepare: false });
  try {
    await sql`truncate rate_limit_counters`;
  } finally {
    await sql.end();
  }
}

// Fills the current and next window, so a window boundary mid-test can't reopen the limit.
export async function fillRateLimit(key: string, count: number, windowMs: number): Promise<void> {
  const sql = postgres(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL, { max: 1, prepare: false });
  const start = Math.floor(Date.now() / windowMs) * windowMs;
  try {
    for (const windowStart of [new Date(start), new Date(start + windowMs)]) {
      await sql`insert into rate_limit_counters (key, window_start, count)
        values (${key}, ${windowStart}, ${count})
        on conflict (key, window_start) do update set count = excluded.count`;
    }
  } finally {
    await sql.end();
  }
}
