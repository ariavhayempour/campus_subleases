import type { Metadata } from 'next';
import { orAdminNotFound } from '@/app/_lib/guards';
import { conversationFromSchema } from '@/lib/validation/moderation';
import { getActor } from '@/server/auth/get-actor';
import { getAdminConversation } from '@/server/services/admin-conversations';
import { AdminThread } from '../../_components/admin-thread';
import { AdminPageHeader } from '../../_components/admin-ui';

export const metadata: Metadata = { title: 'Admin · Conversation' };

type AdminConversationPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
};

function backLink(from: unknown): { href: string; label: string } {
  const parsed = conversationFromSchema.safeParse(from);
  if (!parsed.success) return { href: '/admin/reports', label: 'Back to reports' };
  return parsed.data.kind === 'report'
    ? { href: `/admin/reports/${parsed.data.id}`, label: 'Back to report' }
    : { href: `/admin/users/${parsed.data.id}`, label: 'Back to user' };
}

export default async function AdminConversationPage({
  params,
  searchParams,
}: AdminConversationPageProps) {
  const { id } = await params;
  const back = backLink((await searchParams).from);
  const conversation = await orAdminNotFound(getAdminConversation(await getActor(), id));

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Conversation" back={back}>
        <p className="text-sm text-ink-2">Admin view: read-only. This view is logged.</p>
      </AdminPageHeader>
      <AdminThread conversation={conversation} />
    </div>
  );
}
