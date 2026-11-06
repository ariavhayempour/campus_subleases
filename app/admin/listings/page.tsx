import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Tag } from '@/app/_components/listing-badge';
import { LocalTime } from '@/app/_components/local-time';
import { orAdminNotFound } from '@/app/_lib/guards';
import { getActor } from '@/server/auth/get-actor';
import { listAdminListings } from '@/server/services/admin-listings';
import { listActiveSchools } from '@/server/services/schools';
import { AdminPageHeader, Empty, LINK, SchoolLabel, TABLE, TD, TH } from '../_components/admin-ui';
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

  const colors = new Map(schools.map((s) => [s.slug, s.theme.primary]));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Listings"
        actions={<SchoolFilter tab={tab} school={school} schools={schools} />}
      />
      <div className="-mt-2 border-b border-line">
        <ListingTabs tab={tab} school={school} />
      </div>
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>Title</th>
              <th className={TH}>School</th>
              <th className={TH}>Owner</th>
              <th className={TH}>{tab === 'pending' ? 'Submitted' : 'Updated'}</th>
              <th className={TH}>Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const flags = [
                row.autoHidden ? { label: 'Auto-hidden', tone: 'bg-bad-bg text-bad' } : null,
                row.farFromCampusKm === null
                  ? null
                  : {
                      label: `Far from campus: ${row.farFromCampusKm.toFixed(1)} km`,
                      tone: 'bg-warn-bg text-warn',
                    },
                row.openReports > 0
                  ? {
                      label: `${row.openReports} open report${row.openReports === 1 ? '' : 's'}`,
                      tone: 'bg-ink text-white',
                    }
                  : null,
              ].filter((flag) => flag !== null);
              const when = tab === 'pending' ? row.createdAt : row.updatedAt;
              return (
                <tr key={row.id} className="hover:bg-surface-2">
                  <td className={TD}>
                    <div className="flex items-center gap-3">
                      <span className="relative aspect-[4/3] w-16 shrink-0 overflow-hidden rounded-[4px] bg-surface-2">
                        {row.coverThumbUrl && (
                          <Image
                            src={row.coverThumbUrl}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        )}
                      </span>
                      <Link href={`/admin/listings/${row.id}`} className={LINK}>
                        {row.title}
                      </Link>
                    </div>
                  </td>
                  <td className={TD}>
                    <SchoolLabel name={row.schoolName} color={colors.get(row.schoolSlug)} />
                  </td>
                  <td className={TD}>
                    <Link href={`/admin/users/${row.ownerId}`} prefetch={false} className={LINK}>
                      {row.ownerName}
                    </Link>
                  </td>
                  <td className={`${TD} whitespace-nowrap text-ink-2`}>
                    <LocalTime iso={when.toISOString()} />
                  </td>
                  <td className={TD}>
                    {flags.length > 0 && (
                      <ul className="flex flex-wrap gap-1.5">
                        {flags.map((flag) => (
                          <li key={flag.label}>
                            <Tag className={flag.tone}>{flag.label}</Tag>
                          </li>
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
