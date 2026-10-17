import { requireOnboardedUser, orNotFound } from '@/app/_lib/guards';
import { getThread } from '@/server/services/messaging-reads';
import { ThreadHeader } from '../_components/thread-header';
import { ThreadPanel } from '../_components/thread-panel';

export default async function ThreadPage({ params }: PageProps<'/messages/[id]'>) {
  const { id } = await params;
  const actor = await requireOnboardedUser();
  const thread = await orNotFound(getThread(actor, id));
  return (
    <div className="flex h-full flex-col">
      <ThreadHeader
        listing={thread.listing}
        otherUser={thread.otherUser}
        blocked={thread.composer === 'you_blocked'}
      />
      <div className="min-h-0 flex-1">
        <ThreadPanel key={thread.id} thread={thread} />
      </div>
    </div>
  );
}
