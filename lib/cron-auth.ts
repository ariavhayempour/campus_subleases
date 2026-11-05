import { timingSafeEqual } from 'node:crypto';

export function isCronAuthorized(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || authorization === null) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  // timingSafeEqual throws on unequal lengths.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
