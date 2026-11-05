import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ListingBadge } from '@/app/_components/listing-badge';
import { LocalTime } from '@/app/_components/local-time';
import { orAdminNotFound, requireAdminPage } from '@/app/_lib/guards';
import { ACTION_LABELS, summarizeSnapshot } from '@/lib/audit-labels';
import { formatMonthYear } from '@/lib/format';
import {
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
} from '@/lib/moderation-options';
import { getAdminUser, type AdminReportRow } from '@/server/services/admin-users';
import { BanControls } from '../../_components/ban-controls';

export const metadata: Metadata = { title: 'Admin · User' };

type AdminUserPageProps = { params: Promise<{ id: string }> };

const EMPTY = <p className="text-sm text-muted-foreground">Nothing here.</p>;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-3">
      <h2 id={`${id}-heading`} className="text-lg font-medium">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ReportList({ rows }: { rows: AdminReportRow[] }) {
  if (rows.length === 0) return EMPTY;
  return (
    <ul className="space-y-1 text-sm">
      {rows.map((report) => (
        <li key={report.id}>
          <Link href={`/admin/reports/${report.id}`} prefetch={false} className="underline">
            {REPORT_REASON_LABELS[report.reason]}
          </Link>{' '}
          · {report.targetType}: {report.targetLabel} ·{' '}
          <LocalTime iso={report.createdAt.toISOString()} /> ·{' '}
          {report.reporterName ?? 'Deleted user'} · {REPORT_STATUS_LABELS[report.status]}
        </li>
      ))}
    </ul>
  );
}

export default async function AdminUserPage({ params }: AdminUserPageProps) {
  const { id } = await params;
  const viewer = await requireAdminPage();
  const user = await orAdminNotFound(getAdminUser(viewer, id));
  const banned = user.status === 'banned';
  const canModerate = viewer.userId !== user.id && user.isAdmin !== true;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href="/admin/listings" className="text-sm underline">
          Back to admin
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{user.displayName}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <ListingBadge
            badge={{ label: banned ? 'Banned' : 'Active', tone: banned ? 'danger' : 'success' }}
          />
          <span>Joined {formatMonthYear(user.joinedAt)}</span>
          <span>{user.homeSchool ? user.homeSchool.name : 'No home school'}</span>
        </div>
        {canModerate && (
          <BanControls userId={user.id} displayName={user.displayName} banned={banned} />
        )}
      </header>

      <Section id="listings" title="Listings">
        {user.listings.length === 0 ? (
          EMPTY
        ) : (
          <ul className="space-y-1 text-sm">
            {user.listings.map((listing) => (
              <li key={listing.id}>
                <Link href={`/admin/listings/${listing.id}`} className="underline">
                  {listing.title}
                </Link>{' '}
                · {listing.schoolName} · {REVIEW_STATUS_LABELS[listing.reviewStatus]}
                {listing.openReports > 0 ? ` · ${listing.openReports} open` : ''}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="conversations" title="Conversations">
        {user.conversations.length === 0 ? (
          EMPTY
        ) : (
          <ul className="space-y-1 text-sm">
            {user.conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/admin/conversations/${conversation.id}`}
                  prefetch={false}
                  className="underline"
                >
                  {conversation.listingTitle ?? 'Listing removed'}
                </Link>{' '}
                · as {conversation.role} · with {conversation.otherName ?? 'Deleted user'}
                {conversation.lastMessageAt && (
                  <>
                    {' '}
                    · <LocalTime iso={conversation.lastMessageAt.toISOString()} />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="received" title="Reports received">
        <ReportList rows={user.reportsReceived} />
      </Section>

      <Section id="filed" title="Reports filed">
        <ReportList rows={user.reportsFiled} />
      </Section>

      <Section id="history" title="History">
        {user.history.length === 0 ? (
          EMPTY
        ) : (
          <ul className="space-y-1 text-sm">
            {user.history.map((entry) => (
              <li key={entry.id}>
                <LocalTime iso={entry.createdAt.toISOString()} /> · {ACTION_LABELS[entry.action]} by{' '}
                {entry.adminName ?? 'System'}
                {entry.snapshot ? ` (${summarizeSnapshot(entry.snapshot)})` : ''}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
