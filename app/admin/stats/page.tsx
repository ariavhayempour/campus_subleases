import type { Metadata } from 'next';
import { orAdminNotFound } from '@/app/_lib/guards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDuration, formatPercent } from '@/lib/format';
import { getActor } from '@/server/auth/get-actor';
import { getTrialStats, type SchoolStats } from '@/server/services/admin-stats';
import { listActiveSchools } from '@/server/services/schools';
import { ValidationError } from '@/server/services/errors';
import { AdminPageHeader, SchoolLabel, TABLE, TD, TH } from '../_components/admin-ui';

export const metadata: Metadata = { title: 'Admin · Stats' };

const DAY_MS = 86_400_000;

// Defaults to the last 30 days ending today (UTC date).
function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const start = new Date(today.getTime() - 29 * DAY_MS);
  return { from: start.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
}

export default async function AdminStatsPage({ searchParams }: PageProps<'/admin/stats'>) {
  const params = await searchParams;
  const defaults = defaultRange();
  const from = typeof params.from === 'string' ? params.from : defaults.from;
  const to = typeof params.to === 'string' ? params.to : defaults.to;
  const [actor, schools] = await Promise.all([getActor(), listActiveSchools()]);
  const colors = new Map(schools.map((s) => [s.slug, s.theme.primary]));

  let stats: SchoolStats[] | null = null;
  let error: string | null = null;
  try {
    stats = await orAdminNotFound(getTrialStats(actor, { from, to }));
  } catch (e) {
    if (!(e instanceof ValidationError)) throw e;
    error = e.fieldErrors.to?.[0] ?? e.fieldErrors.from?.[0] ?? 'Choose a valid date range';
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Trial stats" />
      <form method="get" action="/admin/stats" className="flex flex-wrap items-start gap-3">
        <div className="grid gap-1.5">
          <label htmlFor="stats-from" className="text-[13px] font-semibold text-ink">
            From
          </label>
          <Input id="stats-from" type="date" name="from" defaultValue={from} className="w-44" />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="stats-to" className="text-[13px] font-semibold text-ink">
            To
          </label>
          <Input
            id="stats-to"
            type="date"
            name="to"
            defaultValue={to}
            className="w-44"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'stats-to-error' : undefined}
          />
          {error && (
            <p id="stats-to-error" className="text-sm text-bad">
              {error}
            </p>
          )}
        </div>
        <Button type="submit" variant="outline" className="mt-[1.4rem]">
          Apply
        </Button>
      </form>
      {stats && (
        <>
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>School</th>
                <th className={`${TH} text-right`}>Listings posted</th>
                <th className={TH}>Approved listings with a message</th>
                <th className={TH}>Median time to host&apos;s first reply</th>
                <th className={`${TH} text-right`}>Listings marked taken</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => {
                const color = colors.get(row.schoolSlug);
                const share =
                  row.approvedListings === 0 ? 0 : row.approvedWithMessage / row.approvedListings;
                return (
                  <tr key={row.schoolSlug} className="[&>td]:align-middle">
                    <td className={TD}>
                      <SchoolLabel name={row.schoolName} color={color} />
                    </td>
                    <td className={`${TD} numeral text-right text-[1.75rem]`}>
                      {row.listingsPosted}
                    </td>
                    <td className={`${TD} w-[34%]`}>
                      <p>
                        {row.approvedWithMessage} of {row.approvedListings} (
                        {formatPercent(row.approvedWithMessage, row.approvedListings)})
                      </p>
                      <div
                        aria-hidden="true"
                        className="mt-1.5 h-2.5 overflow-hidden rounded-[1px] bg-line"
                      >
                        <i
                          className="block h-full bg-ink"
                          style={{ width: `${share * 100}%`, background: color }}
                        />
                      </div>
                    </td>
                    <td className={TD}>
                      {row.medianFirstReplySeconds === null
                        ? '—'
                        : formatDuration(row.medianFirstReplySeconds)}{' '}
                      <span className="text-ink-2">({row.repliedConversations} replied)</span>
                    </td>
                    <td className={`${TD} numeral text-right text-[1.75rem]`}>
                      {row.listingsTaken}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-sm text-ink-2">
            Computed on request from stored data. Listings approved before the admin dashboard
            existed are not counted as approved.
          </p>
        </>
      )}
    </div>
  );
}
