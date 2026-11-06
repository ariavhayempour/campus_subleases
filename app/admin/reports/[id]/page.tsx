import type { Metadata } from 'next';
import Link from 'next/link';
import { ListingBadge } from '@/app/_components/listing-badge';
import { LocalTime } from '@/app/_components/local-time';
import { orAdminNotFound } from '@/app/_lib/guards';
import { listingBadges } from '@/lib/listing-rules';
import {
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TARGET_LABELS,
  USER_STATUS_LABELS,
} from '@/lib/moderation-options';
import { getActor } from '@/server/auth/get-actor';
import { getReport } from '@/server/services/admin-reports';
import { AdminThread } from '../../_components/admin-thread';
import { ResolveReportForm } from '../../_components/resolve-report-form';
import { AdminPageHeader, AdminSection, LINK } from '../../_components/admin-ui';

export const metadata: Metadata = { title: 'Admin · Report' };

type AdminReportPageProps = { params: Promise<{ id: string }> };

export default async function AdminReportPage({ params }: AdminReportPageProps) {
  const { id } = await params;
  const report = await orAdminNotFound(getReport(await getActor(), id));
  const { target } = report;
  const gone = (
    <p className="rounded-md bg-surface-2 px-4 py-5 text-sm text-ink-2">
      This {report.targetType} no longer exists.
    </p>
  );

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={REPORT_REASON_LABELS[report.reason]}
        back={{ href: '/admin/reports', label: 'Back to reports' }}
      >
        <p className="text-sm text-ink-2">
          Reported by{' '}
          {report.reporter ? (
            <Link href={`/admin/users/${report.reporter.id}`} prefetch={false} className={LINK}>
              {report.reporter.displayName}
            </Link>
          ) : (
            'Deleted user'
          )}{' '}
          · <LocalTime iso={report.createdAt.toISOString()} /> ·{' '}
          {REPORT_STATUS_LABELS[report.status]}
        </p>
        <p className="max-w-[70ch] min-w-0 rounded-md bg-surface-2 px-4 py-3 text-[15px] break-words whitespace-pre-wrap text-ink">
          {report.details ?? 'No details given.'}
        </p>
        {report.otherOpenReports > 0 && (
          <p className="text-sm font-semibold text-warn">
            {report.otherOpenReports} other open report{report.otherOpenReports === 1 ? '' : 's'} on
            this target
          </p>
        )}
      </AdminPageHeader>

      {report.status === 'resolved' && (
        <section aria-labelledby="resolution-heading" className="space-y-1.5 text-sm">
          <h2 id="resolution-heading" className="varsity text-[1.375rem] font-extrabold">
            Resolution
          </h2>
          <p className="text-ink-2">
            Resolved by {report.resolvedByName ?? 'a removed admin'}
            {report.resolvedAt && (
              <>
                {' '}
                · <LocalTime iso={report.resolvedAt.toISOString()} />
              </>
            )}
          </p>
          <p className="min-w-0 whitespace-pre-wrap break-words">{report.resolutionNote}</p>
        </section>
      )}

      <section aria-labelledby="target-heading" className="space-y-3">
        <h2 id="target-heading" className="varsity text-[1.375rem] font-extrabold">
          Reported {REPORT_TARGET_LABELS[report.targetType].toLowerCase()}
        </h2>
        {target.type === 'listing' &&
          (target.listing ? (
            <div className="space-y-2 text-sm">
              <Link href={`/admin/listings/${target.listing.id}`} className={LINK}>
                {target.listing.title}
              </Link>
              <div className="flex flex-wrap gap-2">
                {listingBadges(target.listing).map((badge) => (
                  <ListingBadge key={badge.label} badge={badge} />
                ))}
              </div>
            </div>
          ) : (
            gone
          ))}
        {target.type === 'user' &&
          (target.user ? (
            <p className="text-sm">
              <Link href={`/admin/users/${target.user.id}`} prefetch={false} className={LINK}>
                {target.user.displayName}
              </Link>{' '}
              · {USER_STATUS_LABELS[target.user.status]}
            </p>
          ) : (
            gone
          ))}
        {target.type === 'message' &&
          (target.message && target.conversation ? (
            <div className="space-y-3">
              <p className="text-sm text-ink-2">Admin view: read-only. This view is logged.</p>
              {!target.conversation.messages.some((m) => m.id === target.message?.id) && (
                <div
                  aria-current="true"
                  className="rounded-md bg-warn-bg p-3.5 text-sm ring-2 ring-warn"
                >
                  <p className="text-xs text-ink-2">
                    Reported message · {target.senderName ?? 'Deleted user'} ·{' '}
                    <LocalTime iso={target.message.createdAt} />
                  </p>
                  <p className="min-w-0 whitespace-pre-wrap break-words">{target.message.body}</p>
                </div>
              )}
              <AdminThread
                conversation={target.conversation}
                highlightMessageId={target.message.id}
              />
            </div>
          ) : (
            gone
          ))}
      </section>

      {report.status === 'open' && (
        <AdminSection id="resolve" title="Resolve">
          <ResolveReportForm reportId={report.id} />
        </AdminSection>
      )}
    </div>
  );
}
