import { createHmac, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';

// Mirrors Svix signing: base64 HMAC-SHA256 of "id.timestamp.body" keyed by the decoded secret.
export function signedClerkWebhook(
  payload: unknown,
  secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET ?? '',
): NextRequest {
  const body = JSON.stringify(payload);
  const id = `msg_${randomUUID()}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signature = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  return new NextRequest('http://localhost/api/webhooks/clerk', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${signature}`,
    },
    body,
  });
}
