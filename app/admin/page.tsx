import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { orAdminNotFound } from '@/app/_lib/guards';
import { getActor } from '@/server/auth/get-actor';
import { getAdminCounts } from '@/server/services/admin-listings';
import { listAuditLog } from '@/server/services/audit';
import { AdminPageHeader, AdminSection } from './_components/admin-ui';
import { AuditTable } from './_components/audit-table';

export const metadata: Metadata = { title: 'Admin' };

export default async function AdminOverviewPage() {
  const actor = await getActor();
  const [counts, audit] = await Promise.all([
    orAdminNotFound(getAdminCounts(actor)),
    orAdminNotFound(listAuditLog(actor)),
  ]);
  const queues = [
    {
      href: '/admin/listings',
      count: counts.pendingListings,
      label: 'Pending listings',
      note: 'Oldest first. Approve, reject with a reason, or hide.',
    },
    {
      href: '/admin/reports',
      count: counts.openReports,
      label: 'Open reports',
      note: 'Newest first. Review the target and resolve with a note.',
    },
  ];

  return (
    <div className="space-y-10">
      <AdminPageHeader title="Overview" />
      <ul className="grid grid-cols-2 gap-4">
        {queues.map((queue) => (
          <li key={queue.href}>
            <Link
              href={queue.href}
              prefetch={false}
              className="flex items-center gap-5 rounded-md border border-line p-5 text-ink no-underline transition-colors hover:border-ink-3"
            >
              <span className="numeral text-[3.5rem]">{queue.count}</span>
              <span className="min-w-0">
                <b className="block text-base">{queue.label}</b>
                <span className="text-sm text-ink-2">{queue.note}</span>
              </span>
              <ArrowRight aria-hidden="true" className="ml-auto size-5 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
      <AdminSection id="activity" title="Recent activity">
        <AuditTable entries={audit.slice(0, 10)} />
      </AdminSection>
    </div>
  );
}
