import type { Metadata } from 'next';
import Link from 'next/link';
import { orAdminNotFound } from '@/app/_lib/guards';
import { getActor } from '@/server/auth/get-actor';
import { getAdminConversation } from '@/server/services/admin-conversations';
import { AdminThread } from '../../_components/admin-thread';

export const metadata: Metadata = { title: 'Admin · Conversation' };

type AdminConversationPageProps = { params: Promise<{ id: string }> };

export default async function AdminConversationPage({ params }: AdminConversationPageProps) {
  const { id } = await params;
  const conversation = await orAdminNotFound(getAdminConversation(await getActor(), id));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/admin/reports" className="text-sm underline">
          Back to reports
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Conversation</h1>
        <p className="text-sm text-muted-foreground">Admin view: read-only. This view is logged.</p>
      </header>
      <AdminThread conversation={conversation} />
    </div>
  );
}
