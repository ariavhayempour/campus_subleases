'use client';

import { useRouter } from 'next/navigation';
import { startConversationAction } from '../actions';
import { MessageComposer } from './message-composer';
import { SafetyNote } from './safety-note';

export function NewConversationPanel({ listingId }: { listingId: string }) {
  const router = useRouter();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SafetyNote />
      <div role="log" aria-label="Messages" className="min-h-0 flex-1 overflow-y-auto px-4 py-3" />
      <MessageComposer
        onSubmit={(body) => startConversationAction(listingId, body)}
        onSent={({ conversationId }) => router.replace(`/messages/${conversationId}`)}
      />
    </div>
  );
}
