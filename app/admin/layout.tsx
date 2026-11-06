import type { Metadata } from 'next';
import { requireAdminPage } from '@/app/_lib/guards';
import { getAdminCounts } from '@/server/services/admin-listings';
import { AdminNav } from './_components/admin-nav';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const actor = await requireAdminPage();
  const counts = await getAdminCounts(actor);
  return (
    <div className="flex w-full min-w-[64rem] flex-1">
      <AdminNav pendingListings={counts.pendingListings} openReports={counts.openReports} />
      <main className="min-w-0 flex-1 px-8 pt-7 pb-16">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
