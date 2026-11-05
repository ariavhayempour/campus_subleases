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

export const metadata: Metadata = { title: 'Admin · Report' };

type AdminReportPageProps = { params: Promise<{ id: string }> };

export default async function AdminReportPage({ params }: AdminReportPageProps) {
  const { id } = await params;
  const report = await orAdminNotFound(getReport(await getActor(), id));
  const { target } = report;
  const gone = <p className="text-sm">This {report.targetType} no longer exists.</p>;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href="/admin/reports" className="text-sm underline">
          Back to reports
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {REPORT_REASON_LABELS[report.reason]}
        </h1>
        <p className="text-sm">
          Reported by{' '}
          {report.reporter ? (
            <Link
              href={`/admin/users/${report.reporter.id}`}
              prefetch={false}
              className="underline"
            >
              {report.reporter.displayName}
            </Link>
          ) : (
            'Deleted user'
          )}{' '}
          · <LocalTime iso={report.createdAt.toISOString()} /> ·{' '}
          {REPORT_STATUS_LABELS[report.status]}
        </p>
        <p className="min-w-0 whitespace-pre-wrap break-words text-sm">
          {report.details ?? 'No details given.'}
        </p>
        {report.otherOpenReports > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {report.otherOpenReports} other open report{report.otherOpenReports === 1 ? '' : 's'} on
            this target
          </p>
        )}
      </header>

      {report.status === 'resolved' && (
        <section aria-labelledby="resolution-heading" className="space-y-1 text-sm">
          <h2 id="resolution-heading" className="text-lg font-medium">
            Resolution
          </h2>
          <p>
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
        <h2 id="target-heading" className="text-lg font-medium">
          Reported {REPORT_TARGET_LABELS[report.targetType].toLowerCase()}
        </h2>
        {target.type === 'listing' &&
          (target.listing ? (
            <div className="space-y-2 text-sm">
              <Link href={`/admin/listings/${target.listing.id}`} className="underline">
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
              <Link href={`/admin/users/${target.user.id}`} prefetch={false} className="underline">
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
              <p className="text-sm text-muted-foreground">
                Admin view: read-only. This view is logged.
              </p>
              {!target.conversation.messages.some((m) => m.id === target.message?.id) && (
                <div aria-current="true" className="rounded-lg border p-3 text-sm ring-2 ring-ring">
                  <p className="text-xs text-muted-foreground">
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
        <section aria-labelledby="resolve-heading" className="space-y-3">
          <h2 id="resolve-heading" className="text-lg font-medium">
            Resolve
          </h2>
          <ResolveReportForm reportId={report.id} />
        </section>
      )}
    </div>
  );
}
