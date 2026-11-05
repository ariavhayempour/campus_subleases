import { sql } from 'drizzle-orm';
import { statsRangeSchema } from '@/lib/validation/moderation';
import { db } from '@/server/db/client';
import { requireAdmin, type Actor } from './actor';
import { parseInput } from './errors';

export type SchoolStats = {
  schoolSlug: string;
  schoolName: string;
  listingsPosted: number;
  approvedListings: number;
  approvedWithMessage: number;
  repliedConversations: number;
  medianFirstReplySeconds: number | null;
  listingsTaken: number;
};

type StatsRow = {
  school_slug: string;
  school_name: string;
  listings_posted: number;
  approved_listings: number;
  approved_with_message: number;
  replied_conversations: number;
  median_first_reply_seconds: number | null;
  listings_taken: number;
};

// Dates are compared in each school's timezone; audit target_id is text, so compare as text.
export async function getTrialStats(actor: Actor, input: unknown): Promise<SchoolStats[]> {
  requireAdmin(actor);
  const { from, to } = parseInput(statsRangeSchema, input);
  const rows = await db().execute<StatsRow>(sql`
    with posted as (
      select l.id, l.school_id,
        exists (
          select 1 from admin_audit_log a
          where a.action = 'approved_listing' and a.target_type = 'listing' and a.target_id = l.id::text
        ) as approved,
        exists (select 1 from conversations c where c.listing_id = l.id) as has_conversation
      from listings l
      join schools s on s.id = l.school_id
      where (l.created_at at time zone s.timezone)::date between ${from}::date and ${to}::date
    ),
    replies as (
      select l.school_id,
        extract(epoch from (
          (select min(m.created_at) from messages m
            where m.conversation_id = c.id and m.sender_id = c.host_id and m.created_at > f.first_at)
          - f.first_at
        )) as reply_seconds
      from conversations c
      join listings l on l.id = c.listing_id
      join schools s on s.id = l.school_id
      cross join lateral (
        select min(m.created_at) as first_at from messages m where m.conversation_id = c.id
      ) f
      where c.host_id is not null
        and (c.created_at at time zone s.timezone)::date between ${from}::date and ${to}::date
    )
    select
      s.slug as school_slug,
      s.name as school_name,
      (select count(*) from posted p where p.school_id = s.id)::int as listings_posted,
      (select count(*) from posted p where p.school_id = s.id and p.approved)::int as approved_listings,
      (select count(*) from posted p where p.school_id = s.id and p.approved and p.has_conversation)::int
        as approved_with_message,
      (select count(*) from replies r where r.school_id = s.id and r.reply_seconds is not null)::int
        as replied_conversations,
      (select percentile_cont(0.5) within group (order by r.reply_seconds)
        from replies r where r.school_id = s.id and r.reply_seconds is not null)::float8
        as median_first_reply_seconds,
      (select count(*) from listings l
        where l.school_id = s.id and l.taken_at is not null
          and (l.taken_at at time zone s.timezone)::date between ${from}::date and ${to}::date)::int
        as listings_taken
    from schools s
    where s.is_active
    order by s.name
  `);
  return rows.map((row) => ({
    schoolSlug: row.school_slug,
    schoolName: row.school_name,
    listingsPosted: Number(row.listings_posted),
    approvedListings: Number(row.approved_listings),
    approvedWithMessage: Number(row.approved_with_message),
    repliedConversations: Number(row.replied_conversations),
    medianFirstReplySeconds:
      row.median_first_reply_seconds === null ? null : Number(row.median_first_reply_seconds),
    listingsTaken: Number(row.listings_taken),
  }));
}
