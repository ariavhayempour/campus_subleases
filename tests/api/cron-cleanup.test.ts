import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/cron/cleanup/route';
import { sweepStaleStorage } from '@/server/services/storage-cleanup';

vi.mock('@/server/services/storage-cleanup', () => ({
  sweepStaleStorage: vi.fn(),
}));

const url = 'http://localhost:3000/api/cron/cleanup';
const request = (headers: Record<string, string> = {}): Request => new Request(url, { headers });

beforeEach(() => {
  vi.mocked(sweepStaleStorage).mockReset();
  vi.mocked(sweepStaleStorage).mockResolvedValue({ uploadsRemoved: 1, photosRemoved: 2 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/cron/cleanup', () => {
  it('rejects a request without an authorization header', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-test-secret');
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(sweepStaleStorage).not.toHaveBeenCalled();
  });

  it('rejects a wrong secret', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-test-secret');
    const response = await GET(request({ authorization: 'Bearer wrong-secret' }));
    expect(response.status).toBe(401);
    expect(sweepStaleStorage).not.toHaveBeenCalled();
  });

  it('rejects every request when CRON_SECRET is unset', async () => {
    vi.stubEnv('CRON_SECRET', undefined);
    const response = await GET(request({ authorization: 'Bearer undefined' }));
    expect(response.status).toBe(401);
    expect(sweepStaleStorage).not.toHaveBeenCalled();
  });

  it('sweeps and returns the counts for the correct secret', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-test-secret');
    const response = await GET(request({ authorization: 'Bearer cron-test-secret' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ uploadsRemoved: 1, photosRemoved: 2 });
    expect(sweepStaleStorage).toHaveBeenCalledWith();
  });
});
