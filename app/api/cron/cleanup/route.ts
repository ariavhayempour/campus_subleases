import { isCronAuthorized } from '@/lib/cron-auth';
import { sweepStaleStorage } from '@/server/services/storage-cleanup';

export const dynamic = 'force-dynamic';

// Storage errors propagate so Sentry sees the failure; the next daily run retries.
export async function GET(request: Request): Promise<Response> {
  if (!isCronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  const result = await sweepStaleStorage();
  return Response.json(result, { status: 200 });
}
