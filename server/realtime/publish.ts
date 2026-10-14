import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { storageEnv } from '@/lib/env';
import { REALTIME_EVENT_NAME, userTopic, type RealtimeEvent } from '@/lib/messaging-options';

let client: SupabaseClient | undefined;

function realtimeClient(): SupabaseClient {
  const env = storageEnv();
  client ??= createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export async function publishToUser(userId: string, event: RealtimeEvent): Promise<void> {
  const topic = userTopic(userId);
  const supabase = realtimeClient();
  const channel = supabase.channel(topic, { config: { private: true } });
  try {
    let result: Awaited<ReturnType<typeof channel.httpSend>>;
    try {
      result = await channel.httpSend(REALTIME_EVENT_NAME, event);
    } catch (cause) {
      throw new Error(`Realtime publish failed for ${topic}`, { cause });
    }
    if (!result.success) throw new Error(`Realtime publish failed for ${topic}`, { cause: result });
  } finally {
    // Drop the channel so they do not pile up on a warm instance; cleanup must not mask a publish error.
    await supabase.removeChannel(channel).catch(() => undefined);
  }
}
