import { describe, expect, it } from 'vitest';
import { runAction } from '@/app/_lib/action-result';
import { RateLimited, ValidationError } from '@/server/services/errors';

describe('runAction', () => {
  it('wraps success', async () => {
    expect(await runAction(async () => 42)).toEqual({ ok: true, data: 42 });
  });

  it('maps service errors to a serializable failure', async () => {
    expect(
      await runAction(async () => {
        throw new ValidationError({ title: ['Too short'] });
      }),
    ).toEqual({
      ok: false,
      error: {
        code: 'ValidationError',
        message: 'Check the highlighted fields',
        fieldErrors: { title: ['Too short'] },
      },
    });
    expect(
      await runAction(async () => {
        throw new RateLimited('Slow down');
      }),
    ).toEqual({ ok: false, error: { code: 'RateLimited', message: 'Slow down' } });
  });

  it('rethrows unexpected errors', async () => {
    await expect(
      runAction(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
