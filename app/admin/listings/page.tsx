import type { Metadata } from 'next';
import Link from 'next/link';
import { LocalTime } from '@/app/_components/local-time';
import { orAdminNotFound } from '@/app/_lib/guards';
import { getActor } from '@/server/auth/get-actor';
import { listAdminListings } from '@/server/services/admin-listings';
import { listActiveSchools } from '@/server/services/schools';
import { ListingTabs, TABS } from '../_components/listing-tabs';
import { SchoolFilter } from '../_components/school-filter';

export const metadata: Metadata = { title: 'Admin · Listings' };

export default async function AdminListingsPage({ searchParams }: PageProps<'/admin/listings'>) {
  const params = await searchParams;
  const tab = TABS.find((t) => t.key === params.tab)?.key ?? 'pending'; // repeated params arrive as arrays
  const school = typeof params.school === 'string' ? params.school : '';
  const actor = await getActor();
  const [rows, schools] = await Promise.all([
    orAdminNotFound(listAdminListings(actor, { tab, school })),
    listActiveSchools(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Listings</h1>
      <div className="flex items-end justify-between gap-4">
        <ListingTabs tab={tab} school={school} />
        <SchoolFilter tab={tab} school={school} schools={schools} />
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="py-2 pr-4 font-medium">Title</th>
              <th className="py-2 pr-4 font-medium">School</th>
              <th className="py-2 pr-4 font-medium">Owner</th>
              <th className="py-2 pr-4 font-medium">
                {tab === 'pending' ? 'Submitted' : 'Updated'}
              </th>
              <th className="py-2 font-medium">Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const flags = [
                row.autoHidden ? 'Auto-hidden' : null,
                row.farFromCampusKm === null
                  ? null
                  : `Far from campus: ${row.farFromCampusKm.toFixed(1)} km`,
                row.openReports > 0
                  ? `${row.openReports} open report${row.openReports === 1 ? '' : 's'}`
                  : null,
              ].filter((flag): flag is string => flag !== null);
              const when = tab === 'pending' ? row.createdAt : row.updatedAt;
              return (
                <tr key={row.id} className="border-b align-top">
                  <td className="py-2 pr-4">
                    <Link href={`/admin/listings/${row.id}`} className="underline">
                      {row.title}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{row.schoolName}</td>
                  <td className="py-2 pr-4">
                    <Link
                      href={`/admin/users/${row.ownerId}`}
                      prefetch={false}
                      className="underline"
                    >
                      {row.ownerName}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <LocalTime iso={when.toISOString()} />
                  </td>
                  <td className="py-2">
                    {flags.length > 0 && (
                      <ul className="space-y-0.5">
                        {flags.map((flag) => (
                          <li key={flag}>{flag}</li>
                        ))}
                      </ul>
                    )}
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
