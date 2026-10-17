'use client';

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { mergeMessages } from '@/lib/messages';
import type { MessageView } from '@/lib/messaging-options';
import type { ThreadView } from '@/server/services/messaging-reads';
import { loadEarlierMessagesAction, markReadAction, sendMessageAction } from '../actions';
import { MessageComposer } from './message-composer';
import { MessageList } from './message-list';
import { SafetyNote } from './safety-note';
import { UnblockNotice } from './unblock-notice';

export function ThreadPanel({ thread }: { thread: ThreadView }) {
  const [messages, setMessages] = useState<MessageView[]>(thread.messages);
  const [hasEarlier, setHasEarlier] = useState(thread.hasEarlier);
  const [loadedEarlier, setLoadedEarlier] = useState(false);
  const [seenThread, setSeenThread] = useState(thread);
  const [loadError, setLoadError] = useState(false);
  const [loading, startLoading] = useTransition();

  // The server window slides forward on revalidation; fold it in so seen messages are never dropped.
  if (seenThread !== thread) {
    setSeenThread(thread);
    setMessages((current) => mergeMessages(current, thread.messages));
    if (!loadedEarlier && thread.hasEarlier) setHasEarlier(true);
  }
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef<'bottom' | number | null>('bottom');

  // Pin to the bottom on mount and after sending; keep the viewport steady when older messages load.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || stick.current === null) return;
    el.scrollTop = stick.current === 'bottom' ? el.scrollHeight : el.scrollHeight - stick.current;
    stick.current = null;
  }, [messages]);

  useEffect(() => {
    void markReadAction(thread.id).catch(() => undefined);
  }, [thread.id]);

  function loadEarlier() {
    const oldest = messages[0];
    if (!oldest || !scroller.current) return;
    setLoadError(false);
    startLoading(async () => {
      const result = await loadEarlierMessagesAction(thread.id, oldest.id).catch(() => null);
      if (!result?.ok) {
        setLoadError(true);
        return;
      }
      const el = scroller.current;
      if (el) stick.current = el.scrollHeight - el.scrollTop;
      setHasEarlier(result.data.hasEarlier);
      setLoadedEarlier(true);
      setMessages((current) => mergeMessages(current, result.data.messages));
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SafetyNote />
      <div
        ref={scroller}
        role="log"
        aria-label="Messages"
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
      >
        {hasEarlier && (
          <div className="mb-3 text-center">
            <button
              type="button"
              onClick={loadEarlier}
              disabled={loading}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
            >
              Load earlier messages
            </button>
            {loadError && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                Could not load earlier messages. Try again.
              </p>
            )}
          </div>
        )}
        <MessageList messages={messages} viewerId={thread.viewerId} />
      </div>
      {thread.composer === 'open' && (
        <MessageComposer
          onSubmit={(body) => sendMessageAction(thread.id, body)}
          onSent={(message) => {
            stick.current = 'bottom';
            setMessages((current) => mergeMessages(current, [message]));
          }}
        />
      )}
      {thread.composer === 'you_blocked' && thread.otherUser && (
        <UnblockNotice otherUserId={thread.otherUser.id} />
      )}
      {thread.composer === 'cannot_reply' && (
        <p className="border-t p-3 text-sm text-muted-foreground">
          You can&apos;t reply to this conversation
        </p>
      )}
      {thread.composer === 'deleted_user' && (
        <p className="border-t p-3 text-sm text-muted-foreground">This account was deleted</p>
      )}
    </div>
  );
}
