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
      <div
        role="log"
        aria-label="Messages"
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 overflow-y-auto px-6 py-6 text-center"
      >
        <p className="text-[15px] font-semibold text-ink">Say hi to the host</p>
        <p className="max-w-[40ch] text-sm text-ink-2">
          Ask about move-in dates, roommates, or a time to see the place.
        </p>
      </div>
      <MessageComposer
        onSubmit={(body) => startConversationAction(listingId, body)}
        onSent={({ conversationId }) => router.replace(`/messages/${conversationId}`)}
      />
    </div>
  );
}
