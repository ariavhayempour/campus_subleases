import { randomUUID } from 'node:crypto';
import { like, sql } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { db, rootDb } from '@/server/db/client';
import { rateLimitCounters } from '@/server/db/schema';
import { RateLimited } from '@/server/services/errors';
import {
  consume,
  purgeExpiredRateLimits,
  rateLimitSubject,
  type RateLimitRule,
} from '@/server/services/rate-limit';
import { withRollback } from '../helpers/db';

const rule = (overrides: Partial<RateLimitRule> = {}): RateLimitRule => ({
  name: `test-${randomUUID()}`,
  limit: 3,
  windowMs: 60_000,
  message: 'Slow down',
  ...overrides,
});

describe('consume', () => {
  it('allows up to the limit, then throws RateLimited with the rule message', () =>
    withRollback(async () => {
      const r = rule();
      for (let i = 0; i < 3; i++) await consume(r, 'user-1');
      const error = await consume(r, 'user-1').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(RateLimited);
      expect((error as RateLimited).message).toBe('Slow down');
    }));

  it('counts cost', () =>
    withRollback(async () => {
      const r = rule({ limit: 20 });
      await consume(r, 'user-1', { cost: 19 });
      await expect(consume(r, 'user-1', { cost: 2 })).rejects.toBeInstanceOf(RateLimited);
    }));

  it('does not charge a rejected call, so a smaller request still fits', () =>
    withRollback(async () => {
      const r = rule({ limit: 20 });
      await consume(r, 'user-1', { cost: 15 });
      await expect(consume(r, 'user-1', { cost: 6 })).rejects.toBeInstanceOf(RateLimited);
      await expect(consume(r, 'user-1', { cost: 6 })).rejects.toBeInstanceOf(RateLimited);
      await consume(r, 'user-1', { cost: 5 });
      await expect(consume(r, 'user-1')).rejects.toBeInstanceOf(RateLimited);
    }));

  it('rejects a single call that costs more than the limit without recording it', () =>
    withRollback(async () => {
      const r = rule({ limit: 3 });
      await expect(consume(r, 'user-1', { cost: 4 })).rejects.toBeInstanceOf(RateLimited);
      for (let i = 0; i < 3; i++) await consume(r, 'user-1');
    }));

  it('takes the window from the database clock, not the app server clock', () =>
    withRollback(async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2001-01-01T00:00:00.000Z'));
      try {
        const r = rule();
        await consume(r, 'user-1');
        const [row] = await db()
          .select({ windowStart: rateLimitCounters.windowStart })
          .from(rateLimitCounters)
          .where(like(rateLimitCounters.key, `${r.name}:%`));
        vi.useRealTimers();
        expect(row?.windowStart.getUTCFullYear()).toBeGreaterThan(2001);
      } finally {
        vi.useRealTimers();
      }
    }));

  it('starts a new window at the boundary', () =>
    withRollback(async () => {
      const r = rule({ limit: 1 });
      await consume(r, 'user-1', { now: new Date('2026-11-06T12:00:59.999Z') });
      await expect(
        consume(r, 'user-1', { now: new Date('2026-11-06T12:00:59.999Z') }),
      ).rejects.toBeInstanceOf(RateLimited);
      await consume(r, 'user-1', { now: new Date('2026-11-06T12:01:00.000Z') });
    }));

  it('isolates keys by rule name and subject', () =>
    withRollback(async () => {
      const a = rule({ limit: 1 });
      const b = rule({ limit: 1 });
      await consume(a, 'user-1');
      await consume(a, 'user-2');
      await consume(b, 'user-1');
      await expect(consume(a, 'user-1')).rejects.toBeInstanceOf(RateLimited);
    }));

  it('never lets concurrent calls exceed the limit', async () => {
    const r = rule({ limit: 5 });
    try {
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => consume(r, 'user-1')),
      );
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(5);
    } finally {
      await rootDb()
        .delete(rateLimitCounters)
        .where(like(rateLimitCounters.key, `${r.name}:%`));
    }
  });
});

describe('consume before the table exists', () => {
  it('lets the call through so a deploy that beats its migration keeps working', () =>
    withRollback(async () => {
      await db().execute(sql`drop table rate_limit_counters`);
      await expect(consume(rule(), 'user-1')).resolves.toBeUndefined();
    }));
});

describe('rateLimitSubject', () => {
  it('uses the user id, else the IP, else unknown', () => {
    expect(rateLimitSubject({ kind: 'user', userId: 'user_1', isAdmin: false })).toBe('user_1');
    expect(rateLimitSubject({ kind: 'anonymous', ip: '1.2.3.4' })).toBe('ip:1.2.3.4');
    expect(rateLimitSubject({ kind: 'anonymous' })).toBe('ip:unknown');
  });

  it('groups IPv6 callers by their /64 network', () => {
    const v6 = (ip: string) => rateLimitSubject({ kind: 'anonymous', ip });
    expect(v6('2001:db8:1:2:3:4:5:6')).toBe('ip:2001:db8:1:2::/64');
    expect(v6('2001:DB8:1:2:ffff::9')).toBe('ip:2001:db8:1:2::/64');
    expect(v6('2001:db8::1')).toBe('ip:2001:db8:0:0::/64');
    expect(v6('::1')).toBe('ip:0:0:0:0::/64');
  });

  it('treats an IPv4-mapped IPv6 address as IPv4', () => {
    expect(rateLimitSubject({ kind: 'anonymous', ip: '::ffff:203.0.113.7' })).toBe(
      'ip:203.0.113.7',
    );
  });
});

describe('purgeExpiredRateLimits', () => {
  it('removes rows older than 24 hours and keeps newer ones', () =>
    withRollback(async () => {
      const now = new Date('2026-11-06T12:00:00.000Z');
      await db()
        .insert(rateLimitCounters)
        .values([
          { key: 'old', windowStart: new Date('2026-11-05T11:59:00.000Z'), count: 1 },
          { key: 'new', windowStart: new Date('2026-11-05T12:01:00.000Z'), count: 1 },
        ]);
      expect(await purgeExpiredRateLimits(now)).toBeGreaterThanOrEqual(1);
      const keys = (await db().select().from(rateLimitCounters)).map((row) => row.key);
      expect(keys).toContain('new');
      expect(keys).not.toContain('old');
    }));

  it('measures the 24 hours on the database clock by default', () =>
    withRollback(async () => {
      await db().execute(
        sql`insert into rate_limit_counters (key, window_start, count) values ('stale', now() - interval '2 days', 1)`,
      );
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2001-01-01T00:00:00.000Z'));
      try {
        await purgeExpiredRateLimits();
      } finally {
        vi.useRealTimers();
      }
      const keys = (await db().select().from(rateLimitCounters)).map((row) => row.key);
      expect(keys).not.toContain('stale');
    }));
});
