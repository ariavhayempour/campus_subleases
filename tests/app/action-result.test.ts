import { describe, expect, it } from 'vitest';
import { runAction } from '@/app/_lib/action-result';
import { actionErrorMessage } from '@/app/_lib/action-message';
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

describe('actionErrorMessage', () => {
  const fallback = 'Something went wrong. Try again.';

  it('shows a rate-limit message as written', () => {
    const result = { ok: false, error: { code: 'RateLimited', message: 'Slow down' } } as const;
    expect(actionErrorMessage(result, fallback)).toBe('Slow down');
  });

  it('falls back for other failures and for a thrown action', () => {
    const notFound = {
      ok: false,
      error: { code: 'NotFound', message: 'Listing not found' },
    } as const;
    expect(actionErrorMessage(notFound, fallback)).toBe(fallback);
    expect(actionErrorMessage(null, fallback)).toBe(fallback);
  });
});
