import type { Metadata } from 'next';
import Link from 'next/link';
import { LocalTime } from '@/app/_components/local-time';
import { orAdminNotFound } from '@/app/_lib/guards';
import { Button } from '@/components/ui/button';
import {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TARGET_LABELS,
} from '@/lib/moderation-options';
import { getActor } from '@/server/auth/get-actor';
import { listReports } from '@/server/services/admin-reports';
import { listActiveSchools } from '@/server/services/schools';

export const metadata: Metadata = { title: 'Admin · Reports' };

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

const SELECT_CLASS = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm';

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <form method="get" action="/admin/reports" className="flex flex-wrap items-center gap-2">
        <label htmlFor="status-filter" className="text-sm">
          Status
        </label>
        <select id="status-filter" name="status" defaultValue={status} className={SELECT_CLASS}>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <label htmlFor="school-filter" className="text-sm">
          School
        </label>
        <select id="school-filter" name="school" defaultValue={school} className={SELECT_CLASS}>
          <option value="">All schools</option>
          {schools.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <label htmlFor="reason-filter" className="text-sm">
          Reason
        </label>
        <select id="reason-filter" name="reason" defaultValue={reason} className={SELECT_CLASS}>
          <option value="">All reasons</option>
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {REPORT_REASON_LABELS[r]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" size="sm">
          Filter
        </Button>
      </form>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reports.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="py-2 pr-4 font-medium">Date</th>
              <th className="py-2 pr-4 font-medium">Reason</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 font-medium">Target</th>
              <th className="py-2 pr-4 font-medium">School</th>
              <th className="py-2 pr-4 font-medium">Reporter</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b align-top">
                <td className="py-2 pr-4 whitespace-nowrap">
                  <LocalTime iso={row.createdAt.toISOString()} />
                </td>
                <td className="py-2 pr-4">
                  <Link href={`/admin/reports/${row.id}`} prefetch={false} className="underline">
                    {REPORT_REASON_LABELS[row.reason]}
                  </Link>
                </td>
                <td className="py-2 pr-4">{REPORT_TARGET_LABELS[row.targetType]}</td>
                <td className="py-2 pr-4">{row.targetLabel}</td>
                <td className="py-2 pr-4">{row.schoolSlug ?? ''}</td>
                <td className="py-2 pr-4">{row.reporterName ?? 'Deleted user'}</td>
                <td className="py-2">{REPORT_STATUS_LABELS[row.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
