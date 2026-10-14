import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { rootDb } from '@/server/db/client';

describe('realtime channel policy', () => {
  it('has exactly one policy on realtime.messages: authenticated users select their own topic', async () => {
    const rows = await rootDb().execute<{ cmd: string; roles: string[]; qual: string }>(sql`
      select cmd, roles::text[] as roles, qual from pg_policies
      where schemaname = 'realtime' and tablename = 'messages'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].cmd).toBe('SELECT');
    expect(rows[0].roles).toEqual(['authenticated']);
    expect(rows[0].qual).toContain("'user:'");
    expect(rows[0].qual).toContain('sub');
  });
});
