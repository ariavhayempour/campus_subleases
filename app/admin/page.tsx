import type { Metadata } from 'next';
import Link from 'next/link';
import { orAdminNotFound } from '@/app/_lib/guards';
import { Card, CardContent } from '@/components/ui/card';
import { getActor } from '@/server/auth/get-actor';
import { getAdminCounts } from '@/server/services/admin-listings';
import { listAuditLog } from '@/server/services/audit';
import { AuditTable } from './_components/audit-table';

export const metadata: Metadata = { title: 'Admin' };

export default async function AdminOverviewPage() {
  const actor = await getActor();
  const [counts, audit] = await Promise.all([
    orAdminNotFound(getAdminCounts(actor)),
    orAdminNotFound(listAuditLog(actor)),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
      <div className="grid grid-cols-2 gap-4">
        <Link href="/admin/listings" prefetch={false}>
          <Card className="hover:bg-muted">
            <CardContent>
              <p className="text-sm text-muted-foreground">Pending listings</p>
              <p className="text-3xl font-semibold">{counts.pendingListings}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/reports" prefetch={false}>
          <Card className="hover:bg-muted">
            <CardContent>
              <p className="text-sm text-muted-foreground">Open reports</p>
              <p className="text-3xl font-semibold">{counts.openReports}</p>
            </CardContent>
          </Card>
        </Link>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Recent activity</h2>
        <AuditTable entries={audit.slice(0, 10)} />
      </section>
    </div>
  );
}
