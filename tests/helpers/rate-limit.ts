import { expect } from 'vitest';
import { RateLimited } from '@/server/services/errors';

export const TOO_FAST = "You're doing that too fast — wait a minute and try again.";
export const TOO_MANY_CHANGES = 'Too many changes — try again in an hour.';

export async function expectRateLimited(call: Promise<unknown>, message?: string): Promise<void> {
  const error = await call.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(RateLimited);
  if (message) expect((error as RateLimited).message).toBe(message);
}
