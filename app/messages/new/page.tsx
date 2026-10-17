import { notFound, redirect } from 'next/navigation';
import { orNotFound, requireOnboardedUser } from '@/app/_lib/guards';
import { getConversationStart } from '@/server/services/messaging-reads';
import { NewConversationPanel } from '../_components/new-conversation-panel';
import { ThreadHeader } from '../_components/thread-header';

export default async function NewConversationPage({ searchParams }: PageProps<'/messages/new'>) {
  const { listing } = await searchParams;
  const listingId = typeof listing === 'string' ? listing : null;
  if (!listingId) notFound();
  const actor = await requireOnboardedUser();
  const start = await orNotFound(getConversationStart(actor, listingId));
  if (start.existingConversationId) redirect(`/messages/${start.existingConversationId}`);
  return (
    <div className="flex h-full flex-col">
      <ThreadHeader listing={start.listing} otherUser={start.host} showMenu={false} />
      <div className="min-h-0 flex-1">
        <NewConversationPanel listingId={start.listing.id} />
      </div>
    </div>
  );
}
