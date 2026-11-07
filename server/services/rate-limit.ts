import * as Sentry from '@sentry/nextjs';
import { lt, sql, type SQL } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { rateLimitCounters } from '@/server/db/schema';
import type { Actor } from './actor';
import { RateLimited } from './errors';
import { hasPgCode } from './pg-errors';

export type RateLimitRule = { name: string; limit: number; windowMs: number; message: string };

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
// Longer than every window, so purged rows can no longer affect a count.
const RETENTION_MS = 24 * HOUR_MS;

const TOO_FAST = "You're doing that too fast — wait a minute and try again.";
const TOO_MANY_CHANGES = 'Too many changes — try again in an hour.';

const perMinute = (name: string, limit: number): RateLimitRule => ({
  name,
  limit,
  windowMs: MINUTE_MS,
  message: TOO_FAST,
});
const perHour = (name: string, limit: number, message = TOO_MANY_CHANGES): RateLimitRule => ({
  name,
  limit,
  windowMs: HOUR_MS,
  message,
});

export const RATE_LIMITS = {
  photoUploads: perHour('photo-uploads', 20, 'Too many photo uploads — try again in an hour'),
  favorites: perMinute('favorites', 20),
  loadMore: perMinute('load-more', 20),
  // Many signed-out students can share one campus NAT address, so the per-IP allowance is higher.
  loadMoreSignedOut: perMinute('load-more', 120),
  earlierMessages: perMinute('earlier-messages', 15),
  blocks: perHour('blocks', 10),
  listingChanges: perHour('listing-changes', 5),
  onboarding: perHour('onboarding', 10),
} as const satisfies Record<string, RateLimitRule>;

// One IPv6 client usually controls a whole /64, so it is keyed by that prefix.
function ipKey(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1]!;
  if (!ip.includes(':')) return ip;
  const [head = '', tail = ''] = ip.toLowerCase().split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = ip.includes('::')
    ? [...left, ...Array<string>(8 - left.length - right.length).fill('0'), ...right]
    : left;
  const prefix = groups.slice(0, 4).map((group) => (parseInt(group, 16) || 0).toString(16));
  return `${prefix.join(':')}::/64`;
}

export function rateLimitSubject(actor: Actor): string {
  return actor.kind === 'user' ? actor.userId : `ip:${actor.ip ? ipKey(actor.ip) : 'unknown'}`;
}

// Clock-aligned window computed by the database, so app servers with skewed clocks agree.
function windowStartSql(windowMs: number, now?: Date): SQL {
  const at = now ? sql`${now.toISOString()}::timestamptz` : sql`clock_timestamp()`;
  return sql`to_timestamp(floor(extract(epoch from ${at}) * 1000 / ${windowMs}::bigint) * ${windowMs}::bigint / 1000.0)`;
}

// Fixed window, one atomic upsert per call; a rejected call changes nothing, so a smaller one can still fit.
export async function consume(
  rule: RateLimitRule,
  subject: string,
  options: { cost?: number; now?: Date } = {},
): Promise<void> {
  const cost = options.cost ?? 1;
  if (cost > rule.limit) throw new RateLimited(rule.message);
  let rows: { count: number }[];
  try {
    rows = await db()
      .insert(rateLimitCounters)
      .values({
        key: `${rule.name}:${subject}`,
        windowStart: windowStartSql(rule.windowMs, options.now),
        count: cost,
      })
      .onConflictDoUpdate({
        target: [rateLimitCounters.key, rateLimitCounters.windowStart],
        set: { count: sql`${rateLimitCounters.count} + ${cost}::int` },
        setWhere: sql`${rateLimitCounters.count} + ${cost}::int <= ${rule.limit}::int`,
      })
      .returning({ count: rateLimitCounters.count });
  } catch (error) {
    // A deploy can land before its migration creates the table; fail open rather than break every action.
    if (!hasPgCode(error, '42P01')) throw error;
    Sentry.captureException(error);
    return;
  }
  // No returned row means the conflicting update's WHERE refused it.
  if (rows.length === 0) throw new RateLimited(rule.message);
}

export async function purgeExpiredRateLimits(now?: Date): Promise<number> {
  const cutoff = now
    ? new Date(now.getTime() - RETENTION_MS)
    : sql`clock_timestamp() - ${RETENTION_MS}::bigint * interval '1 millisecond'`;
  const deleted = await db()
    .delete(rateLimitCounters)
    .where(lt(rateLimitCounters.windowStart, cutoff))
    .returning({ key: rateLimitCounters.key });
  return deleted.length;
}
