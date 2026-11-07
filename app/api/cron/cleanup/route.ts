import { isCronAuthorized } from '@/lib/cron-auth';
import { purgeExpiredRateLimits } from '@/server/services/rate-limit';
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
  // Independent jobs: one failing must not skip the other; the first failure still propagates.
  const [storage, purge] = await Promise.allSettled([
    sweepStaleStorage(),
    purgeExpiredRateLimits(),
  ]);
  if (storage.status === 'rejected') throw storage.reason;
  if (purge.status === 'rejected') throw purge.reason;
  return Response.json({ ...storage.value, rateLimitRowsDeleted: purge.value }, { status: 200 });
}
