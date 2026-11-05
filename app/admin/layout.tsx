import type { Metadata } from 'next';
import { requireAdminPage } from '@/app/_lib/guards';
import { AdminNav } from './_components/admin-nav';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  await requireAdminPage();
  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-[64rem] flex-1 gap-8 px-4 py-8">
      <AdminNav />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
