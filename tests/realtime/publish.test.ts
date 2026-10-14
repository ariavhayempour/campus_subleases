import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userTopic, type RealtimeEvent } from '@/lib/messaging-options';
import { publishToUser } from '@/server/realtime/publish';
import { joinChannel, localRealtimeClient, nextBroadcast } from '../helpers/realtime';

const event = (conversationId: string): RealtimeEvent => ({
  type: 'message',
  conversationId,
  message: {
    id: randomUUID(),
    conversationId,
    senderId: 'user_x',
    body: 'hi',
    createdAt: new Date().toISOString(),
  },
});

const clients: SupabaseClient[] = [];
const clientFor = (userId: string): SupabaseClient => {
  const client = localRealtimeClient(userId);
  clients.push(client);
  return client;
};

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.resetModules();
  await Promise.all(clients.splice(0).map((client) => client.removeAllChannels()));
});

describe('publishToUser', () => {
  const alice = `user_rt_${randomUUID()}`;
  const bob = `user_rt_${randomUUID()}`;

  it('delivers an event to the user subscribed to their own channel', async () => {
    const { status, channel } = await joinChannel(clientFor(alice), userTopic(alice));
    expect(status).toBe('SUBSCRIBED');
    const received = nextBroadcast(channel);
    const sent = event(randomUUID());
    await publishToUser(alice, sent);
    expect(await received).toEqual(sent);
  });

  it("refuses to let a user join another user's channel", async () => {
    const { status } = await joinChannel(clientFor(alice), userTopic(bob));
    expect(status).toBe('CHANNEL_ERROR');
  });

  it('resolves when nobody is subscribed', async () => {
    await expect(publishToUser(alice, event(randomUUID()))).resolves.toBeUndefined();
  });

  it('rejects with the topic and a cause when Realtime is unreachable', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:1');
    vi.resetModules();
    const { publishToUser: publishUnreachable } = await import('@/server/realtime/publish');
    await expect(publishUnreachable(alice, event(randomUUID()))).rejects.toMatchObject({
      message: expect.stringContaining('user:'),
      cause: expect.anything(),
    });
  });
});
