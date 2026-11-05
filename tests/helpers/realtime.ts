import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { REALTIME_EVENT_NAME } from '@/lib/messaging-options';

type LocalStatus = { API_URL: string; PUBLISHABLE_KEY: string; JWT_SECRET: string };

let status: LocalStatus | undefined;

function localStatus(): LocalStatus {
  if (!status) {
    const output = execFileSync('supabase', ['status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    status = JSON.parse(output) as LocalStatus;
    const host = new URL(status.API_URL).hostname;
    if (host !== '127.0.0.1' && host !== 'localhost') {
      throw new Error(`Tests only run against local Supabase, not ${host}`);
    }
  }
  return status;
}

const base64url = (value: string): string => Buffer.from(value).toString('base64url');

function signToken(userId: string, secret: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + 600;
  const claims = base64url(
    JSON.stringify({ sub: userId, role: 'authenticated', aud: 'authenticated', exp }),
  );
  const signature = createHmac('sha256', secret).update(`${header}.${claims}`).digest('base64url');
  return `${header}.${claims}.${signature}`;
}

export function localRealtimeClient(userId: string): SupabaseClient {
  const { API_URL, PUBLISHABLE_KEY, JWT_SECRET } = localStatus();
  const token = signToken(userId, JWT_SECRET);
  return createClient(API_URL, PUBLISHABLE_KEY, {
    accessToken: async () => token,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// The text Realtime sends when the channel policy denies a private join.
const REFUSED_JOIN = /^Unauthorized: You do not have permissions to read from this Channel topic/;

const broadcasts = new WeakMap<RealtimeChannel, Promise<unknown>>();

type JoinOptions = {
  // 'subscribed' rides out transient CHANNEL_ERRORs; 'refused' wants a policy denial first.
  expect?: 'subscribed' | 'refused';
  private?: boolean;
  timeoutMs?: number;
};

export function anonRealtimeClient(): SupabaseClient {
  const { API_URL, PUBLISHABLE_KEY } = localStatus();
  return createClient(API_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
}

export async function joinChannel(
  client: SupabaseClient,
  topic: string,
  options: JoinOptions = {},
): Promise<{ status: string; channel: RealtimeChannel }> {
  const { expect = 'subscribed', private: isPrivate = true, timeoutMs = 10_000 } = options;
  // Push the user token before joining; otherwise the join carries the publishable key.
  if (isPrivate) await client.realtime.setAuth();
  const channel = client.channel(topic, { config: { private: isPrivate } });
  broadcasts.set(
    channel,
    new Promise((resolve) => {
      channel.on('broadcast', { event: REALTIME_EVENT_NAME }, ({ payload }) => resolve(payload));
    }),
  );
  return new Promise((resolve, reject) => {
    let lastError = 'none';
    const timer = setTimeout(() => {
      reject(
        new Error(`Join of ${topic} did not settle in ${timeoutMs}ms (last error: ${lastError})`),
      );
    }, timeoutMs);
    const done = (fn: () => void) => {
      clearTimeout(timer);
      fn();
    };
    channel.subscribe((state, error) => {
      if (state === 'SUBSCRIBED') done(() => resolve({ status: state, channel }));
      else if (state === 'CHANNEL_ERROR') {
        const cause = error ?? new Error(`Join of ${topic} failed with no error`);
        lastError = cause.message;
        if (expect !== 'refused') return;
        if (REFUSED_JOIN.test(cause.message)) done(() => resolve({ status: state, channel }));
        else done(() => reject(cause));
      } else if (state === 'CLOSED' || state === 'TIMED_OUT') {
        done(() => reject(new Error(`Join of ${topic} ended with ${state}`)));
      }
    });
  });
}

// The listener is registered in joinChannel, so a broadcast sent before this call is not lost.
export function nextBroadcast(channel: RealtimeChannel): Promise<unknown> {
  const pending = broadcasts.get(channel);
  if (!pending) throw new Error('Channel was not created by joinChannel');
  return pending;
}

// Removes every client's channels even if one fails; the error names each failure.
export async function removeClients(clients: SupabaseClient[]): Promise<void> {
  const results = await Promise.allSettled(clients.map((client) => client.removeAllChannels()));
  const reasons = results.flatMap((r) => (r.status === 'rejected' ? [r.reason as unknown] : []));
  if (reasons.length === 0) return;
  const messages = reasons.map((reason) =>
    reason instanceof Error ? reason.message : String(reason),
  );
  throw new AggregateError(reasons, `Realtime cleanup failed: ${messages.join('; ')}`);
}
