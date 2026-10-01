import { verifyWebhook } from '@clerk/nextjs/webhooks';
import type { NextRequest } from 'next/server';
import { deleteUserFromClerk, syncUserFromClerk } from '@/server/services/users';

export async function POST(request: NextRequest): Promise<Response> {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    event = await verifyWebhook(request);
  } catch {
    return new Response('Invalid webhook signature', {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  switch (event.type) {
    case 'user.created':
    case 'user.updated':
      await syncUserFromClerk({
        id: event.data.id,
        firstName: event.data.first_name,
        lastName: event.data.last_name,
        banned: event.data.banned,
      });
      break;
    case 'user.deleted':
      if (event.data.id) await deleteUserFromClerk(event.data.id);
      break;
  }

  return Response.json({ received: true }, { status: 200 });
}
