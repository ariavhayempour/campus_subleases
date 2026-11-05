import type { Metadata } from 'next';
import { orAdminNotFound } from '@/app/_lib/guards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDuration, formatPercent } from '@/lib/format';
import { getActor } from '@/server/auth/get-actor';
import { getTrialStats, type SchoolStats } from '@/server/services/admin-stats';
import { ValidationError } from '@/server/services/errors';

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
  const actor = await getActor();

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
      <h1 className="text-2xl font-semibold tracking-tight">Trial stats</h1>
      <form method="get" action="/admin/stats" className="flex flex-wrap items-start gap-4">
        <div className="space-y-1">
          <label htmlFor="stats-from" className="text-sm">
            From
          </label>
          <Input id="stats-from" type="date" name="from" defaultValue={from} className="w-44" />
        </div>
        <div className="space-y-1">
          <label htmlFor="stats-to" className="text-sm">
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
            <p id="stats-to-error" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <Button type="submit" variant="outline" size="sm" className="mt-6">
          Apply
        </Button>
      </form>
      {stats && (
        <>
          <table className="w-full text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">School</th>
                <th className="py-2 pr-4 font-medium">Listings posted</th>
                <th className="py-2 pr-4 font-medium">Approved listings with a message</th>
                <th className="py-2 pr-4 font-medium">Median time to host&apos;s first reply</th>
                <th className="py-2 font-medium">Listings marked taken</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={row.schoolSlug} className="border-b align-top">
                  <td className="py-2 pr-4">{row.schoolName}</td>
                  <td className="py-2 pr-4">{row.listingsPosted}</td>
                  <td className="py-2 pr-4">
                    {row.approvedWithMessage} of {row.approvedListings} (
                    {formatPercent(row.approvedWithMessage, row.approvedListings)})
                  </td>
                  <td className="py-2 pr-4">
                    {row.medianFirstReplySeconds === null
                      ? '—'
                      : formatDuration(row.medianFirstReplySeconds)}{' '}
                    <span className="text-muted-foreground">
                      ({row.repliedConversations} replied)
                    </span>
                  </td>
                  <td className="py-2">{row.listingsTaken}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-muted-foreground">
            Computed on request from stored data. Listings approved before the admin dashboard
            existed are not counted as approved.
          </p>
        </>
      )}
    </div>
  );
}
