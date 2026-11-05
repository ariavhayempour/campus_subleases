import { and, desc, eq, ne, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { ListingStatus, ReviewStatus } from '@/lib/listing-options';
import type { MessageView } from '@/lib/messaging-options';
import { ADMIN_LIST_LIMIT } from '@/lib/moderation-options';
import { isUuid } from '@/lib/validation/listing';
import { reportsQuerySchema, resolveReportSchema } from '@/lib/validation/moderation';
import { db } from '@/server/db/client';
import { listings, messages, reports, schools, users } from '@/server/db/schema';
import { requireAdmin, type Actor } from './actor';
import { loadAdminConversation, type AdminConversationView } from './admin-conversations';
import { reportRowsQuery, reportSchoolSlug, type AdminReportRow } from './admin-users';
import type { UserStatus } from './admin-listings';
import { writeAudit } from './audit';
import { Conflict, NotFound, parseInput } from './errors';
import type { Participant } from './messaging-reads';
import { isExpired } from './listing-sql';
import { toMessageView } from './messaging';

export type ReportView = AdminReportRow & {
  details: string | null;
  reporter: Participant | null;
  resolvedByName: string | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  otherOpenReports: number;
  target:
    | {
        type: 'listing';
        listing: {
          id: string;
          title: string;
          schoolSlug: string;
          reviewStatus: ReviewStatus;
          status: ListingStatus;
          reviewNote: string | null;
          isExpired: boolean;
          ownerId: string;
          ownerName: string;
        } | null;
      }
    | { type: 'user'; user: { id: string; displayName: string; status: UserStatus } | null }
    | {
        type: 'message';
        message: MessageView | null;
        senderName: string | null;
        conversation: AdminConversationView | null;
      };
};

const reportNotFound = (): NotFound => new NotFound('Report not found');

export async function listReports(actor: Actor, input: unknown): Promise<AdminReportRow[]> {
  requireAdmin(actor);
  const { status, school, reason } = parseInput(reportsQuerySchema, input);
  const filters: SQL[] = [];
  if (status !== 'all') filters.push(eq(reports.status, status));
  if (reason) filters.push(eq(reports.reason, reason));
  if (school) filters.push(eq(reportSchoolSlug, school));
  return reportRowsQuery()
    .where(and(...filters))
    .orderBy(desc(reports.createdAt), desc(reports.id))
    .limit(ADMIN_LIST_LIMIT);
}

export async function getReport(actor: Actor, reportId: string): Promise<ReportView> {
  const admin = requireAdmin(actor);
  if (!isUuid(reportId)) throw reportNotFound();
  const [base] = await reportRowsQuery().where(eq(reports.id, reportId));
  if (!base) throw reportNotFound();

  const resolver = alias(users, 'resolver');
  const reporterUser = alias(users, 'reporter_user');
  const [extra] = await db()
    .select({
      details: reports.details,
      resolvedAt: reports.resolvedAt,
      resolutionNote: reports.resolutionNote,
      reporterId: reporterUser.id,
      reporterName: reporterUser.displayName,
      resolvedByName: resolver.displayName,
    })
    .from(reports)
    .leftJoin(reporterUser, eq(reporterUser.id, reports.reporterId))
    .leftJoin(resolver, eq(resolver.id, reports.resolvedBy))
    .where(eq(reports.id, reportId));

  const [{ n: otherOpenReports }] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(reports)
    .where(
      and(
        eq(reports.status, 'open'),
        eq(reports.targetType, base.targetType),
        eq(reports.targetId, base.targetId),
        ne(reports.id, reportId),
      ),
    );

  return {
    ...base,
    details: extra.details,
    reporter: extra.reporterId
      ? { id: extra.reporterId, displayName: extra.reporterName ?? '' }
      : null,
    resolvedByName: extra.resolvedByName,
    resolvedAt: extra.resolvedAt,
    resolutionNote: extra.resolutionNote,
    otherOpenReports,
    target: await loadTarget(base, admin.userId),
  };
}

async function loadTarget(base: AdminReportRow, adminId: string): Promise<ReportView['target']> {
  const { targetType, targetId } = base;
  if (targetType === 'user') {
    const [user] = await db()
      .select({ id: users.id, displayName: users.displayName, status: users.status })
      .from(users)
      .where(eq(users.id, targetId));
    return { type: 'user', user: user ?? null };
  }
  if (targetType === 'listing') {
    const [row] = isUuid(targetId)
      ? await db()
          .select({
            id: listings.id,
            title: listings.title,
            schoolSlug: schools.slug,
            reviewStatus: listings.reviewStatus,
            status: listings.status,
            reviewNote: listings.reviewNote,
            isExpired,
            ownerId: listings.ownerId,
            ownerName: users.displayName,
          })
          .from(listings)
          .innerJoin(schools, eq(schools.id, listings.schoolId))
          .innerJoin(users, eq(users.id, listings.ownerId))
          .where(eq(listings.id, targetId))
      : [];
    return { type: 'listing', listing: row ?? null };
  }
  const [row] = isUuid(targetId)
    ? await db()
        .select({ message: messages, senderName: users.displayName })
        .from(messages)
        .leftJoin(users, eq(users.id, messages.senderId))
        .where(eq(messages.id, targetId))
    : [];
  if (!row) return { type: 'message', message: null, senderName: null, conversation: null };
  const conversation = await db().transaction((tx) =>
    loadAdminConversation(tx, row.message.conversationId, adminId),
  );
  return {
    type: 'message',
    message: toMessageView(row.message),
    senderName: row.senderName,
    conversation,
  };
}

export async function resolveReport(actor: Actor, input: unknown): Promise<void> {
  const admin = requireAdmin(actor);
  const { reportId, note } = parseInput(resolveReportSchema, input);
  await db().transaction(async (tx) => {
    const [row] = await tx
      .select({ status: reports.status })
      .from(reports)
      .where(eq(reports.id, reportId))
      .for('update');
    if (!row) throw reportNotFound();
    if (row.status !== 'open') throw new Conflict('This report is already resolved');
    await tx
      .update(reports)
      .set({
        status: 'resolved',
        resolvedBy: admin.userId,
        resolvedAt: sql`now()`,
        resolutionNote: note,
      })
      .where(eq(reports.id, reportId));
    await writeAudit(tx, {
      adminId: admin.userId,
      action: 'resolved_report',
      targetType: 'report',
      targetId: reportId,
      snapshot: { note },
    });
  });
}
