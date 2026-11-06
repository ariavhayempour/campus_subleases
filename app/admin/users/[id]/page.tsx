import type { Metadata } from 'next';
import Link from 'next/link';
import { ListingBadge } from '@/app/_components/listing-badge';
import { LocalTime } from '@/app/_components/local-time';
import { orAdminNotFound, requireAdminPage } from '@/app/_lib/guards';
import { ACTION_LABELS, summarizeSnapshot } from '@/lib/audit-labels';
import { formatMonthYear } from '@/lib/format';
import {
  auditActorLabel,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
} from '@/lib/moderation-options';
import { getAdminUser, type AdminReportRow } from '@/server/services/admin-users';
import { BanControls } from '../../_components/ban-controls';
import {
  AdminPageHeader,
  AdminSection,
  Dot,
  Empty,
  LINK,
  Row,
  RowList,
} from '../../_components/admin-ui';

export const metadata: Metadata = { title: 'Admin · User' };

type AdminUserPageProps = { params: Promise<{ id: string }> };

const EMPTY = <Empty />;

function ReportList({ rows }: { rows: AdminReportRow[] }) {
  if (rows.length === 0) return EMPTY;
  return (
    <RowList>
      {rows.map((report) => (
        <Row key={report.id}>
          <Link href={`/admin/reports/${report.id}`} prefetch={false} className={LINK}>
            {REPORT_REASON_LABELS[report.reason]}
          </Link>
          <Dot />
          <span>
            {report.targetType}: {report.targetLabel}
          </span>
          <Dot />
          <LocalTime iso={report.createdAt.toISOString()} className="text-ink-2" />
          <Dot />
          <span>{report.reporterName ?? 'Deleted user'}</span>
          <Dot />
          <span className="text-ink-2">{REPORT_STATUS_LABELS[report.status]}</span>
        </Row>
      ))}
    </RowList>
  );
}

export default async function AdminUserPage({ params }: AdminUserPageProps) {
  const { id } = await params;
  const viewer = await requireAdminPage();
  const user = await orAdminNotFound(getAdminUser(viewer, id));
  const banned = user.status === 'banned';
  const canModerate = viewer.userId !== user.id && user.isAdmin !== true;

  return (
    <div className="space-y-9">
      <AdminPageHeader
        title={user.displayName}
        back={{ href: '/admin/listings', label: 'Back to admin' }}
        actions={
          canModerate ? (
            <BanControls userId={user.id} displayName={user.displayName} banned={banned} />
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-3 text-sm text-ink-2">
          <ListingBadge
            badge={{ label: banned ? 'Banned' : 'Active', tone: banned ? 'danger' : 'success' }}
          />
          <span>Joined {formatMonthYear(user.joinedAt)}</span>
          <span>{user.homeSchool ? user.homeSchool.name : 'No home school'}</span>
        </div>
      </AdminPageHeader>

      <AdminSection id="listings" title="Listings">
        {user.listings.length === 0 ? (
          EMPTY
        ) : (
          <RowList>
            {user.listings.map((listing) => (
              <Row key={listing.id}>
                <Link href={`/admin/listings/${listing.id}`} className={LINK}>
                  {listing.title}
                </Link>
                <Dot />
                <span>{listing.schoolName}</span>
                <Dot />
                <span className="text-ink-2">{REVIEW_STATUS_LABELS[listing.reviewStatus]}</span>
                {listing.openReports > 0 && (
                  <>
                    <Dot />
                    <span className="font-semibold text-warn">{listing.openReports} open</span>
                  </>
                )}
              </Row>
            ))}
          </RowList>
        )}
      </AdminSection>

      <AdminSection id="conversations" title="Conversations">
        {user.conversations.length === 0 ? (
          EMPTY
        ) : (
          <RowList>
            {user.conversations.map((conversation) => (
              <Row key={conversation.id}>
                <Link
                  href={`/admin/conversations/${conversation.id}?from=user:${user.id}`}
                  prefetch={false}
                  className={LINK}
                >
                  {conversation.listingTitle ?? 'Listing removed'}
                </Link>
                <Dot />
                <span>
                  as {conversation.role} · with {conversation.otherName ?? 'Deleted user'}
                </span>
                {conversation.lastMessageAt && (
                  <>
                    <Dot />
                    <LocalTime
                      iso={conversation.lastMessageAt.toISOString()}
                      className="text-ink-2"
                    />
                  </>
                )}
              </Row>
            ))}
          </RowList>
        )}
      </AdminSection>

      <AdminSection id="received" title="Reports received">
        <ReportList rows={user.reportsReceived} />
      </AdminSection>

      <AdminSection id="filed" title="Reports filed">
        <ReportList rows={user.reportsFiled} />
      </AdminSection>

      <AdminSection id="history" title="History">
        {user.history.length === 0 ? (
          EMPTY
        ) : (
          <RowList>
            {user.history.map((entry) => (
              <Row key={entry.id}>
                <LocalTime iso={entry.createdAt.toISOString()} className="text-ink-2" />
                <Dot />
                <span>
                  <span className="font-semibold">{ACTION_LABELS[entry.action]}</span> by{' '}
                  {auditActorLabel(entry)}
                  {entry.snapshot ? ` (${summarizeSnapshot(entry.snapshot)})` : ''}
                </span>
              </Row>
            ))}
          </RowList>
        )}
      </AdminSection>
    </div>
  );
}
