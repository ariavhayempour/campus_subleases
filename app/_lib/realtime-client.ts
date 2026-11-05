import { createClient } from '@supabase/supabase-js';
import { REALTIME_EVENT_NAME, userTopic, type RealtimeEvent } from '@/lib/messaging-options';

type SubscribeOptions = {
  userId: string;
  getToken: () => Promise<string | null>;
  onEvent: (event: RealtimeEvent) => void;
  onSubscribed: (isReconnect: boolean) => void;
};

export function subscribeToUserChannel(options: SubscribeOptions): (() => void) | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;

  const client = createClient(url, publishableKey, { accessToken: options.getToken });
  let stopped = false;
  let subscribedBefore = false;

  const start = async () => {
    // The socket only carries the Clerk token if auth is set before joining a private channel.
    await client.realtime.setAuth();
    if (stopped) return;
    client
      .channel(userTopic(options.userId), { config: { private: true } })
      .on('broadcast', { event: REALTIME_EVENT_NAME }, ({ payload }) => {
        options.onEvent(payload as RealtimeEvent);
      })
      .subscribe((status) => {
        if (stopped) return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`Realtime channel ${status}; live delivery may be unavailable`);
        }
        if (status !== 'SUBSCRIBED') return;
        options.onSubscribed(subscribedBefore);
        subscribedBefore = true;
      });
  };
  void start().catch((error: unknown) => {
    console.warn('Realtime setup failed', error instanceof Error ? error.message : 'unknown error');
  });

  return () => {
    stopped = true;
    void client.removeAllChannels().catch(() => undefined);
  };
}
