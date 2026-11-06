import { and, countDistinct, eq, gt, or, sql } from 'drizzle-orm';
import {
  AUTO_HIDE_REPORTERS,
  MAX_REPORTS_PER_DAY,
  REPORT_DUPLICATE,
  REPORT_RATE_LIMITED,
  type ReportTargetType,
} from '@/lib/moderation-options';
import { isUuid } from '@/lib/validation/listing';
import { reportInputSchema } from '@/lib/validation/moderation';
import { db } from '@/server/db/client';
import { conversations, listings, messages, reports, schools, users } from '@/server/db/schema';
import { requireUser, type Actor, type UserActor } from './actor';
import { writeAudit } from './audit';
import { Conflict, NotFound, parseInput, RateLimited, ValidationError } from './errors';
import { isPublicListing, noBlockWith } from './listing-sql';
import { assertInHomeSchool } from './school-lock';

const selfError = (message: string): ValidationError =>
  new ValidationError({ targetId: [message] });

// Throws NotFound unless the reporter may see the target, and a field error for self-reports.
async function assertReportable(
  reporter: UserActor,
  targetType: ReportTargetType,
  targetId: string,
): Promise<void> {
  const reporterId = reporter.userId;
  if (targetType === 'user') {
    const [row] = await db().select({ id: users.id }).from(users).where(eq(users.id, targetId));
    if (!row) throw new NotFound();
    if (row.id === reporterId) throw selfError("You can't report yourself");
    return;
  }
  if (!isUuid(targetId)) throw new NotFound();
  if (targetType === 'listing') {
    const [row] = await db()
      .select({ ownerId: listings.ownerId, schoolId: listings.schoolId })
      .from(listings)
      .innerJoin(schools, eq(schools.id, listings.schoolId))
      .innerJoin(users, eq(users.id, listings.ownerId))
      .where(
        and(
          eq(listings.id, targetId),
          or(
            and(isPublicListing, noBlockWith(reporterId)),
            sql`exists (
              select 1 from ${conversations}
              where ${conversations.listingId} = ${listings.id}
                and ${conversations.renterId} = ${reporterId}
            )`,
          ),
        ),
      );
    if (!row) throw new NotFound();
    if (row.ownerId === reporterId) throw selfError("You can't report your own listing");
    await assertInHomeSchool(reporter, row.schoolId);
    return;
  }
  const [row] = await db()
    .select({ senderId: messages.senderId })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(
      and(
        eq(messages.id, targetId),
        or(eq(conversations.hostId, reporterId), eq(conversations.renterId, reporterId)),
      ),
    );
  if (!row) throw new NotFound();
  if (row.senderId === reporterId) throw selfError("You can't report your own message");
}

export async function createReport(
  actor: Actor,
  input: unknown,
): Promise<{ id: string; autoHidden: boolean }> {
  const reporter = requireUser(actor);
  const { userId } = reporter;
  const { targetType, targetId, reason, details } = parseInput(reportInputSchema, input);
  await assertReportable(reporter, targetType, targetId);

  return db().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('reports:' || ${userId}))`);
    const [recent] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(reports)
      .where(
        and(
          eq(reports.reporterId, userId),
          gt(reports.createdAt, sql`now() - interval '24 hours'`),
        ),
      );
    if (recent.total >= MAX_REPORTS_PER_DAY) throw new RateLimited(REPORT_RATE_LIMITED);

    const [created] = await tx
      .insert(reports)
      .values({ reporterId: userId, targetType, targetId, reason, details })
      .onConflictDoNothing()
      .returning({ id: reports.id });
    if (!created) throw new Conflict(REPORT_DUPLICATE);
    if (targetType !== 'listing') return { id: created.id, autoHidden: false };

    // Row lock: exactly one concurrent report crosses the threshold. Text keeps microseconds.
    const [listing] = await tx
      .select({
        reviewStatus: listings.reviewStatus,
        countSince: sql<string>`coalesce(${listings.reviewedAt}, ${listings.createdAt})::text`,
      })
      .from(listings)
      .where(eq(listings.id, targetId))
      .for('update');
    if (listing?.reviewStatus !== 'approved') return { id: created.id, autoHidden: false };

    const [{ reporters }] = await tx
      .select({ reporters: countDistinct(reports.reporterId) })
      .from(reports)
      .where(
        and(
          eq(reports.targetType, 'listing'),
          eq(reports.targetId, targetId),
          gt(reports.createdAt, sql`${listing.countSince}::timestamptz`),
        ),
      );
    if (reporters < AUTO_HIDE_REPORTERS) return { id: created.id, autoHidden: false };

    await tx.update(listings).set({ reviewStatus: 'hidden' }).where(eq(listings.id, targetId));
    await writeAudit(tx, {
      adminId: null,
      action: 'auto_hid_listing',
      targetType: 'listing',
      targetId,
    });
    return { id: created.id, autoHidden: true };
  });
}
