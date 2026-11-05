import type { Metadata } from 'next';
import { requireOnboardedUser } from '@/app/_lib/guards';
import { getInbox } from '@/server/services/messaging-reads';
import { InboxList } from './_components/inbox-list';
import { MessagesShell } from './_components/messages-shell';
import { ResyncRefresher } from './_components/resync-refresher';

export const metadata: Metadata = {
  title: 'Messages',
  robots: { index: false, follow: false },
};

export default async function MessagesLayout({ children }: LayoutProps<'/messages'>) {
  const actor = await requireOnboardedUser();
  const inbox = await getInbox(actor);
  return (
    <>
      <ResyncRefresher />
      <MessagesShell inbox={<InboxList items={inbox} />}>{children}</MessagesShell>
    </>
  );
}
