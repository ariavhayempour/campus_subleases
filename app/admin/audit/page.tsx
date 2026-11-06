import type { Metadata } from 'next';
import { orAdminNotFound } from '@/app/_lib/guards';
import { getActor } from '@/server/auth/get-actor';
import { listAuditLog } from '@/server/services/audit';
import { AdminPageHeader } from '../_components/admin-ui';
import { AuditTable } from '../_components/audit-table';

export const metadata: Metadata = { title: 'Admin · Audit log' };

export default async function AdminAuditPage() {
  const entries = await orAdminNotFound(listAuditLog(await getActor()));
  return (
    <div className="space-y-6">
      <AdminPageHeader title="Audit log">
        <p className="text-sm text-ink-2">The latest 200 actions, newest first.</p>
      </AdminPageHeader>
      <AuditTable entries={entries} />
    </div>
  );
}
