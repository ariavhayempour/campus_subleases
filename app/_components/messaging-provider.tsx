'use client';

import { useAuth } from '@clerk/nextjs';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getUnreadCountAction } from '@/app/messages/actions';
import { subscribeToUserChannel } from '@/app/_lib/realtime-client';
import { withUnreadPrefix } from '@/lib/messages';
import type { RealtimeEvent } from '@/lib/messaging-options';

type Messaging = {
  unreadCount: number;
  refreshUnread: () => Promise<void>;
  onEvent: (listener: (event: RealtimeEvent) => void) => () => void;
  onResync: (listener: () => void) => () => void;
};

const MessagingContext = createContext<Messaging | null>(null);

export function useMessaging(): Messaging {
  const value = useContext(MessagingContext);
  if (!value) throw new Error('useMessaging must be used inside MessagingProvider');
  return value;
}

function useListeners<T extends unknown[]>() {
  const set = useRef(new Set<(...args: T) => void>());
  const add = useCallback((listener: (...args: T) => void) => {
    set.current.add(listener);
    return () => {
      set.current.delete(listener);
    };
  }, []);
  const emit = useCallback((...args: T) => {
    set.current.forEach((listener) => listener(...args));
  }, []);
  return { add, emit };
}

export function MessagingProvider({ children }: { children: ReactNode }) {
  const { userId, getToken } = useAuth();
  const [counts, setCounts] = useState<{ userId: string | null; value: number }>({
    userId: null,
    value: 0,
  });
  const { add: addEventListener, emit: emitEvent } = useListeners<[RealtimeEvent]>();
  const { add: addResyncListener, emit: emitResync } = useListeners<[]>();
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  });

  const unreadCount = userId && counts.userId === userId ? counts.value : 0;

  const refreshUnread = useCallback(async () => {
    if (!userId) return;
    const value = await getUnreadCountAction().catch(() => null);
    if (value !== null) setCounts({ userId, value });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void Promise.resolve().then(refreshUnread);
    let lastResync = 0;
    const resync = () => {
      // focus and visibilitychange fire together on tab return; run one resync.
      if (Date.now() - lastResync < 1000) return;
      lastResync = Date.now();
      void refreshUnread();
      emitResync();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') resync();
    };
    window.addEventListener('focus', resync);
    document.addEventListener('visibilitychange', onVisible);
    const unsubscribe = subscribeToUserChannel({
      userId,
      getToken: () => getTokenRef.current(),
      onEvent: (event) => {
        emitEvent(event);
        void refreshUnread();
      },
      onSubscribed: (isReconnect) => {
        if (isReconnect) resync();
      },
    });
    return () => {
      window.removeEventListener('focus', resync);
      document.removeEventListener('visibilitychange', onVisible);
      unsubscribe?.();
    };
  }, [userId, refreshUnread, emitEvent, emitResync]);

  // Next rewrites <title> on navigation, so re-apply the prefix whenever it changes.
  useEffect(() => {
    const apply = () => {
      const next = withUnreadPrefix(document.title, unreadCount);
      if (next !== document.title) document.title = next;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [unreadCount]);

  const value = useMemo<Messaging>(
    () => ({ unreadCount, refreshUnread, onEvent: addEventListener, onResync: addResyncListener }),
    [unreadCount, refreshUnread, addEventListener, addResyncListener],
  );
  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}
