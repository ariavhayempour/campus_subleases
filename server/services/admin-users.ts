import * as Sentry from '@sentry/nextjs';
import { alias } from 'drizzle-orm/pg-core';
import { and, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import {
  ADMIN_LIST_LIMIT,
  type ReportReason,
  type ReportTargetType,
} from '@/lib/moderation-options';
import { formatDisplayName } from '@/lib/display-name';
import { banSchema } from '@/lib/validation/moderation';
import { getClerkAccount, setClerkBan } from '@/server/clerk/users';
import { db } from '@/server/db/client';
import { conversations, listings, messages, reports, schools, users } from '@/server/db/schema';
import { requireAdmin, type Actor } from './actor';
import { adminListingRowsQuery, type AdminListingRow, type UserStatus } from './admin-listings';
import { listAuditFor, writeAudit, type AdminAction, type AuditEntry } from './audit';
import { Forbidden, NotFound, parseInput } from './errors';
import { lockMessagingUsers } from './locks';
import { syncUserFromClerk } from './users';

export type AdminReportRow = {
  id: string;
  createdAt: Date;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  status: 'open' | 'resolved';
  reporterName: string | null;
  targetLabel: string;
  schoolSlug: string | null;
};

export type AdminUserView = {
  id: string;
  displayName: string;
  status: UserStatus;
  joinedAt: Date;
  homeSchool: { slug: string; name: string } | null;
  // null when Clerk could not say (unreachable or no such account)
  isAdmin: boolean | null;
  listings: AdminListingRow[];
  conversations: {
    id: string;
    role: 'host' | 'renter';
    listingTitle: string | null;
    otherName: string | null;
    lastMessageAt: Date | null;
  }[];
  reportsFiled: AdminReportRow[];
  reportsReceived: AdminReportRow[];
  history: AuditEntry[];
};

const reporter = alias(users, 'reporter');
const targetUser = alias(users, 'target_user');
const targetListing = alias(listings, 'target_listing');
const targetMessage = alias(messages, 'target_message');
const messageConversation = alias(conversations, 'message_conversation');
const messageListing = alias(listings, 'message_listing');
const messageSender = alias(users, 'message_sender');
const targetSchool = alias(schools, 'target_school');

// Callers add where/orderBy/limit; the target joins resolve label and school per target type.
export function reportRowsQuery() {
  return db()
    .select({
      id: reports.id,
      createdAt: reports.createdAt,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      status: reports.status,
      reporterName: reporter.displayName,
      targetLabel: sql<string>`coalesce(case ${reports.targetType}
        when 'listing' then ${targetListing.title}
        when 'user' then ${targetUser.displayName}
        when 'message' then left(${targetMessage.body}, 80)
      end, 'Deleted')`,
      schoolSlug: targetSchool.slug,
    })
    .from(reports)
    .leftJoin(reporter, eq(reporter.id, reports.reporterId))
    .leftJoin(
      targetListing,
      and(eq(reports.targetType, 'listing'), sql`${targetListing.id}::text = ${reports.targetId}`),
    )
    .leftJoin(targetUser, and(eq(reports.targetType, 'user'), eq(targetUser.id, reports.targetId)))
    .leftJoin(
      targetMessage,
      and(eq(reports.targetType, 'message'), sql`${targetMessage.id}::text = ${reports.targetId}`),
    )
    .leftJoin(messageConversation, eq(messageConversation.id, targetMessage.conversationId))
    .leftJoin(messageListing, eq(messageListing.id, messageConversation.listingId))
    .leftJoin(messageSender, eq(messageSender.id, targetMessage.senderId))
    .leftJoin(
      targetSchool,
      eq(
        targetSchool.id,
        sql`coalesce(${targetListing.schoolId}, ${messageListing.schoolId}, ${targetUser.homeSchoolId}, ${messageSender.homeSchoolId})`,
      ),
    );
}

const targetsUser = (userId: string): SQL =>
  or(
    and(eq(reports.targetType, 'user'), eq(reports.targetId, userId)),
    and(
      eq(reports.targetType, 'listing'),
      sql`${reports.targetId} in (select ${listings.id}::text from ${listings} where ${listings.ownerId} = ${userId})`,
    ),
    and(
      eq(reports.targetType, 'message'),
      sql`${reports.targetId} in (select ${messages.id}::text from ${messages} where ${messages.senderId} = ${userId})`,
    ),
  ) as SQL;

// Clerk being unreachable must not take the page down; the service re-checks on ban.
async function clerkAdminFlag(userId: string): Promise<boolean | null> {
  try {
    return (await getClerkAccount(userId))?.isAdmin ?? null;
  } catch (error) {
    Sentry.captureException(error);
    return null;
  }
}

const newestFirst = [desc(reports.createdAt), desc(reports.id)] as const;

export async function getAdminUser(actor: Actor, userId: string): Promise<AdminUserView> {
  requireAdmin(actor);
  const homeSchool = alias(schools, 'home_school');
  const [row] = await db()
    .select({
      id: users.id,
      displayName: users.displayName,
      status: users.status,
      joinedAt: users.createdAt,
      schoolSlug: homeSchool.slug,
      schoolName: homeSchool.name,
    })
    .from(users)
    .leftJoin(homeSchool, eq(homeSchool.id, users.homeSchoolId))
    .where(eq(users.id, userId));
  if (!row) throw new NotFound('User not found');

  const host = alias(users, 'host');
  const renter = alias(users, 'renter');
  const [isAdmin, ownedListings, convoRows, reportsFiled, reportsReceived, history] =
    await Promise.all([
      clerkAdminFlag(userId),
      adminListingRowsQuery()
        .where(eq(listings.ownerId, userId))
        .orderBy(desc(listings.updatedAt), desc(listings.id))
        .limit(ADMIN_LIST_LIMIT),
      db()
        .select({
          id: conversations.id,
          hostId: conversations.hostId,
          listingTitle: listings.title,
          hostName: host.displayName,
          renterName: renter.displayName,
          lastMessageAt: conversations.lastMessageAt,
        })
        .from(conversations)
        .leftJoin(listings, eq(listings.id, conversations.listingId))
        .leftJoin(host, eq(host.id, conversations.hostId))
        .leftJoin(renter, eq(renter.id, conversations.renterId))
        .where(or(eq(conversations.hostId, userId), eq(conversations.renterId, userId)))
        .orderBy(desc(conversations.lastMessageAt), desc(conversations.id))
        .limit(ADMIN_LIST_LIMIT),
      reportRowsQuery()
        .where(eq(reports.reporterId, userId))
        .orderBy(...newestFirst)
        .limit(ADMIN_LIST_LIMIT),
      reportRowsQuery()
        .where(targetsUser(userId))
        .orderBy(...newestFirst)
        .limit(ADMIN_LIST_LIMIT),
      listAuditFor('user', userId),
    ]);

  return {
    id: row.id,
    displayName: row.displayName,
    status: row.status,
    joinedAt: row.joinedAt,
    homeSchool:
      row.schoolSlug && row.schoolName ? { slug: row.schoolSlug, name: row.schoolName } : null,
    isAdmin,
    listings: ownedListings,
    conversations: convoRows.map((c) => {
      const isHost = c.hostId === userId;
      return {
        id: c.id,
        role: isHost ? 'host' : 'renter',
        listingTitle: c.listingTitle,
        otherName: isHost ? c.renterName : c.hostName,
        lastMessageAt: c.lastMessageAt,
      };
    }),
    reportsFiled,
    reportsReceived,
    history,
  };
}

async function setBan(actor: Actor, input: unknown, banned: boolean): Promise<void> {
  const admin = requireAdmin(actor);
  const { userId } = parseInput(banSchema, input);
  const verb = banned ? 'ban' : 'unban';
  if (userId === admin.userId) throw new Forbidden(`You can't ${verb} yourself`);
  const current = await getClerkAccount(userId);
  if (!current) throw new NotFound('User not found');
  if (current.isAdmin) throw new Forbidden(`Admins can't be ${banned ? 'banned' : 'unbanned'}`);

  // Clerk stays the source of truth; its returned state is mirrored locally right away.
  const alreadyApplied = current.banned === banned;
  const updated = alreadyApplied ? current : await setClerkBan(userId, banned);
  const action: AdminAction = banned ? 'banned_user' : 'unbanned_user';
  await db().transaction(async (tx) => {
    await lockMessagingUsers(tx, [userId]);
    await syncUserFromClerk(updated, tx);
    // A no-op request changed nothing, so it leaves no audit row.
    if (alreadyApplied) return;
    await writeAudit(tx, {
      adminId: admin.userId,
      action,
      targetType: 'user',
      targetId: userId,
      snapshot: { displayName: formatDisplayName(updated.firstName, updated.lastName) },
    });
  });
}

export const banUser = (actor: Actor, input: unknown): Promise<void> => setBan(actor, input, true);

export const unbanUser = (actor: Actor, input: unknown): Promise<void> =>
  setBan(actor, input, false);
