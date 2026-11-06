import type { Metadata } from 'next';
import Link from 'next/link';
import { LocalTime } from '@/app/_components/local-time';
import { orAdminNotFound } from '@/app/_lib/guards';
import { Button } from '@/components/ui/button';
import { Tag } from '@/app/_components/listing-badge';
import {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TARGET_LABELS,
} from '@/lib/moderation-options';
import { getActor } from '@/server/auth/get-actor';
import { listReports } from '@/server/services/admin-reports';
import { listActiveSchools } from '@/server/services/schools';
import {
  AdminPageHeader,
  Empty,
  LINK,
  SELECT,
  SchoolLabel,
  TABLE,
  TD,
  TH,
} from '../_components/admin-ui';

export const metadata: Metadata = { title: 'Admin · Reports' };

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

const FIELD = 'grid gap-1.5 text-[13px] font-semibold text-ink';

export default async function AdminReportsPage({ searchParams }: PageProps<'/admin/reports'>) {
  const params = await searchParams;
  const status = STATUSES.find((s) => s.value === params.status)?.value ?? 'open';
  const school =
    typeof params.school === 'string' && params.school.length <= 100 ? params.school : '';
  const reason = REPORT_REASONS.find((r) => r === params.reason) ?? '';
  const actor = await getActor();
  const [rows, schools] = await Promise.all([
    orAdminNotFound(listReports(actor, { status, school, reason })),
    listActiveSchools(),
  ]);

  const bySlug = new Map(schools.map((s) => [s.slug, s]));

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Reports" />
      <form method="get" action="/admin/reports" className="flex flex-wrap items-end gap-3">
        <label className={FIELD}>
          Status
          <select id="status-filter" name="status" defaultValue={status} className={SELECT}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className={FIELD}>
          School
          <select id="school-filter" name="school" defaultValue={school} className={SELECT}>
            <option value="">All schools</option>
            {schools.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className={FIELD}>
          Reason
          <select id="reason-filter" name="reason" defaultValue={reason} className={SELECT}>
            <option value="">All reasons</option>
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>
                {REPORT_REASON_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>
      {rows.length === 0 ? (
        <Empty>No reports.</Empty>
      ) : (
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>Date</th>
              <th className={TH}>Reason</th>
              <th className={TH}>Type</th>
              <th className={TH}>Target</th>
              <th className={TH}>School</th>
              <th className={TH}>Reporter</th>
              <th className={TH}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowSchool = row.schoolSlug ? bySlug.get(row.schoolSlug) : undefined;
              return (
                <tr key={row.id} className="hover:bg-surface-2">
                  <td className={`${TD} whitespace-nowrap text-ink-2`}>
                    <LocalTime iso={row.createdAt.toISOString()} />
                  </td>
                  <td className={TD}>
                    <Link href={`/admin/reports/${row.id}`} prefetch={false} className={LINK}>
                      {REPORT_REASON_LABELS[row.reason]}
                    </Link>
                  </td>
                  <td className={`${TD} text-ink-2`}>{REPORT_TARGET_LABELS[row.targetType]}</td>
                  <td className={TD}>{row.targetLabel}</td>
                  <td className={TD}>
                    {row.schoolSlug && (
                      <SchoolLabel
                        name={rowSchool?.shortName ?? row.schoolSlug}
                        color={rowSchool?.theme.primary}
                      />
                    )}
                  </td>
                  <td className={TD}>{row.reporterName ?? 'Deleted user'}</td>
                  <td className={TD}>
                    <Tag
                      className={
                        row.status === 'open' ? 'bg-warn-bg text-warn' : 'bg-surface-2 text-ink-2'
                      }
                    >
                      {REPORT_STATUS_LABELS[row.status]}
                    </Tag>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
