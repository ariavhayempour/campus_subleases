import { cache } from 'react';
import { and, asc, count, desc, eq, sql, type SQL } from 'drizzle-orm';
import type { ListingStatus, ReviewStatus } from '@/lib/listing-options';
import {
  ADMIN_LIST_LIMIT,
  REVIEW_STATE_CHANGED,
  STALE_REVIEW,
  type ReportReason,
} from '@/lib/moderation-options';
import {
  adminDeleteListingSchema,
  adminListingsQuerySchema,
  approveSchema,
  listingIdSchema,
  rejectSchema,
} from '@/lib/validation/moderation';
import { isUuid } from '@/lib/validation/listing';
import { db, type DbExecutor } from '@/server/db/client';
import { listingPhotos, listings, reports, schools, users } from '@/server/db/schema';
import type { userStatus } from '@/server/db/schema/enums';
import { requireAdmin, type Actor } from './actor';
import { listAuditFor, writeAudit, type AdminAction, type AuditEntry } from './audit';
import { bestEffort } from './best-effort';
import { Conflict, NotFound, parseInput } from './errors';
import { coverJoin } from './listing-cards';
import { getListingDetail, type ListingDetail } from './listing-reads';
import { isExpired, listingVersion } from './listing-sql';
import { deleteListingRow } from './listings';
import { deleteProcessedPhotos, photoUrls } from './photos';

export type UserStatus = (typeof userStatus.enumValues)[number];

export type AdminListingRow = {
  id: string;
  title: string;
  schoolSlug: string;
  schoolName: string;
  ownerId: string;
  ownerName: string;
  reviewStatus: ReviewStatus;
  status: ListingStatus;
  createdAt: Date;
  updatedAt: Date;
  autoHidden: boolean;
  farFromCampusKm: number | null;
  openReports: number;
  coverThumbUrl: string | null;
};

export type AdminListingView = {
  detail: ListingDetail;
  version: string;
  owner: {
    id: string;
    displayName: string;
    status: UserStatus;
    joinedAt: Date;
    listingCount: number;
  };
  farFromCampusKm: number | null;
  autoHidden: boolean;
  history: AuditEntry[];
  reports: {
    id: string;
    createdAt: Date;
    reason: ReportReason;
    status: 'open' | 'resolved';
    reporterName: string | null;
  }[];
};

const notFound = (): NotFound => new NotFound('Listing not found');

const distanceKm: SQL<number> = sql<number>`ST_Distance(${listings.location}, ${schools.campusLocation}) / 1000`;

const farFromCampus: SQL<number | null> = sql<
  number | null
>`case when ${distanceKm} > ${schools.warnRadiusKm} then ${distanceKm} end`;

// A newer auto-hide audit row than the last review means no admin has looked at it yet.
const autoHiddenFlag: SQL<boolean> = sql<boolean>`(${listings.reviewStatus} = 'hidden' and exists (
  select 1 from admin_audit_log a
  where a.action = 'auto_hid_listing' and a.target_type = 'listing' and a.target_id = ${listings.id}::text
    and a.created_at > coalesce(${listings.reviewedAt}, ${listings.createdAt})
))`;

const openReportCount: SQL<number> = sql<number>`(
  select count(*)::int from ${reports}
  where ${reports.targetType} = 'listing' and ${reports.targetId} = ${listings.id}::text
    and ${reports.status} = 'open'
)`;

const pendingQueue: SQL = sql.join(
  [
    sql`(${eq(listings.reviewStatus, 'pending')})`,
    sql`(${eq(listings.status, 'active')})`,
    sql`(not ${isExpired})`,
  ],
  sql` and `,
);

// Callers add where/orderBy/limit; shared with the per-user listing section.
export function adminListingRowsQuery() {
  return db()
    .select({
      id: listings.id,
      title: listings.title,
      schoolSlug: schools.slug,
      schoolName: schools.name,
      ownerId: listings.ownerId,
      ownerName: users.displayName,
      reviewStatus: listings.reviewStatus,
      status: listings.status,
      createdAt: listings.createdAt,
      updatedAt: listings.updatedAt,
      autoHidden: autoHiddenFlag,
      farFromCampusKm: farFromCampus,
      openReports: openReportCount,
      coverPath: listingPhotos.storagePath,
    })
    .from(listings)
    .innerJoin(schools, eq(schools.id, listings.schoolId))
    .innerJoin(users, eq(users.id, listings.ownerId))
    .leftJoin(listingPhotos, coverJoin);
}

type AdminListingQueryRow = Omit<AdminListingRow, 'coverThumbUrl'> & { coverPath: string | null };

export function toAdminListingRow({ coverPath, ...row }: AdminListingQueryRow): AdminListingRow {
  return { ...row, coverThumbUrl: coverPath ? photoUrls(coverPath).thumb : null };
}

export async function listAdminListings(actor: Actor, input: unknown): Promise<AdminListingRow[]> {
  requireAdmin(actor);
  const { tab, school } = parseInput(adminListingsQuerySchema, input);
  const rows = await adminListingRowsQuery()
    .where(
      and(
        tab === 'pending' ? pendingQueue : eq(listings.reviewStatus, tab),
        school ? eq(schools.slug, school) : undefined,
      ),
    )
    .orderBy(
      ...(tab === 'pending'
        ? [asc(listings.createdAt), asc(listings.id)]
        : [desc(listings.updatedAt), desc(listings.id)]),
    )
    .limit(ADMIN_LIST_LIMIT);
  return rows.map(toAdminListingRow);
}

export async function getAdminListing(actor: Actor, listingId: string): Promise<AdminListingView> {
  requireAdmin(actor);
  if (!isUuid(listingId)) throw notFound();
  // Read the version first: an edit in between yields a token older than the content shown.
  const [meta] = await db()
    .select({
      version: listingVersion,
      farFromCampusKm: farFromCampus,
      autoHidden: autoHiddenFlag,
      ownerId: users.id,
      ownerName: users.displayName,
      ownerStatus: users.status,
      ownerJoinedAt: users.createdAt,
    })
    .from(listings)
    .innerJoin(schools, eq(schools.id, listings.schoolId))
    .innerJoin(users, eq(users.id, listings.ownerId))
    .where(eq(listings.id, listingId));
  if (!meta) throw notFound();
  const detail = await getListingDetail(actor, listingId);

  const [[owned], history, reportRows] = await Promise.all([
    db().select({ n: count() }).from(listings).where(eq(listings.ownerId, meta.ownerId)),
    listAuditFor('listing', listingId),
    db()
      .select({
        id: reports.id,
        createdAt: reports.createdAt,
        reason: reports.reason,
        status: reports.status,
        reporterName: users.displayName,
      })
      .from(reports)
      .leftJoin(users, eq(users.id, reports.reporterId))
      .where(and(eq(reports.targetType, 'listing'), eq(reports.targetId, listingId)))
      .orderBy(desc(reports.createdAt), desc(reports.id)),
  ]);

  return {
    detail,
    version: meta.version,
    owner: {
      id: meta.ownerId,
      displayName: meta.ownerName,
      status: meta.ownerStatus,
      joinedAt: meta.ownerJoinedAt,
      listingCount: owned.n,
    },
    farFromCampusKm: meta.farFromCampusKm,
    autoHidden: meta.autoHidden,
    history,
    reports: reportRows,
  };
}

// Cached per request so the header's two nav links and the page share one query run.
export const getAdminCounts = cache(
  async (actor: Actor): Promise<{ pendingListings: number; openReports: number }> => {
    requireAdmin(actor);
    const [[pending], [open]] = await Promise.all([
      db()
        .select({ n: count() })
        .from(listings)
        .innerJoin(schools, eq(schools.id, listings.schoolId))
        .where(pendingQueue),
      db().select({ n: count() }).from(reports).where(eq(reports.status, 'open')),
    ]);
    return { pendingListings: pending.n, openReports: open.n };
  },
);

type Decision = {
  action: Extract<
    AdminAction,
    'approved_listing' | 'rejected_listing' | 'hid_listing' | 'unhid_listing'
  >;
  from: ReviewStatus[];
  to: ReviewStatus;
  note: 'set' | 'clear' | 'keep';
};

async function decide(
  adminId: string,
  listingId: string,
  decision: Decision,
  options: { version?: string; note?: string },
): Promise<void> {
  await db().transaction(async (tx) => {
    const [row] = await tx
      .select({ reviewStatus: listings.reviewStatus, version: listingVersion })
      .from(listings)
      .where(eq(listings.id, listingId))
      .for('update');
    if (!row) throw new NotFound('Listing not found');
    // State first, so a second admin racing the first sees the status change, not a stale token.
    if (!decision.from.includes(row.reviewStatus)) throw new Conflict(REVIEW_STATE_CHANGED);
    if (options.version !== undefined && row.version !== options.version) {
      throw new Conflict(STALE_REVIEW);
    }

    await tx
      .update(listings)
      .set({
        reviewStatus: decision.to,
        reviewedBy: adminId,
        reviewedAt: sql`now()`,
        ...(decision.note === 'set' ? { reviewNote: options.note } : {}),
        ...(decision.note === 'clear' ? { reviewNote: null } : {}),
      })
      .where(eq(listings.id, listingId));
    await writeAudit(tx, {
      adminId,
      action: decision.action,
      targetType: 'listing',
      targetId: listingId,
      snapshot: decision.action === 'rejected_listing' ? { note: options.note } : undefined,
    });
  });
}

export async function approveListing(actor: Actor, input: unknown): Promise<void> {
  const admin = requireAdmin(actor);
  const { listingId, version } = parseInput(approveSchema, input);
  await decide(
    admin.userId,
    listingId,
    { action: 'approved_listing', from: ['pending'], to: 'approved', note: 'clear' },
    { version },
  );
}

export async function rejectListing(actor: Actor, input: unknown): Promise<void> {
  const admin = requireAdmin(actor);
  const { listingId, version, note } = parseInput(rejectSchema, input);
  await decide(
    admin.userId,
    listingId,
    { action: 'rejected_listing', from: ['pending'], to: 'rejected', note: 'set' },
    { version, note },
  );
}

export async function hideListing(actor: Actor, input: unknown): Promise<void> {
  const admin = requireAdmin(actor);
  const { listingId } = parseInput(listingIdSchema, input);
  await decide(
    admin.userId,
    listingId,
    { action: 'hid_listing', from: ['approved', 'hidden'], to: 'hidden', note: 'keep' },
    {},
  );
}

export async function unhideListing(actor: Actor, input: unknown): Promise<void> {
  const admin = requireAdmin(actor);
  const { listingId } = parseInput(listingIdSchema, input);
  await decide(
    admin.userId,
    listingId,
    { action: 'unhid_listing', from: ['hidden'], to: 'approved', note: 'clear' },
    {},
  );
}

export async function deleteListingAsAdmin(actor: Actor, input: unknown): Promise<void> {
  const admin = requireAdmin(actor);
  const { listingId } = parseInput(adminDeleteListingSchema, input);
  const paths = await db().transaction(async (tx: DbExecutor) => {
    const [row] = await tx
      .select({ title: listings.title, ownerId: listings.ownerId, schoolSlug: schools.slug })
      .from(listings)
      .innerJoin(schools, eq(schools.id, listings.schoolId))
      .where(eq(listings.id, listingId))
      .for('update', { of: listings });
    if (!row) throw new NotFound('Listing not found');
    const paths = await deleteListingRow(tx, listingId);
    await writeAudit(tx, {
      adminId: admin.userId,
      action: 'deleted_listing',
      targetType: 'listing',
      targetId: listingId,
      snapshot: { title: row.title, ownerId: row.ownerId, schoolSlug: row.schoolSlug },
    });
    return paths;
  });
  await bestEffort(() => deleteProcessedPhotos(paths));
}
