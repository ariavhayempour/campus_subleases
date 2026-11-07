import type { ActionResult } from './action-result';

export const GENERIC_FAILURE = 'Something went wrong. Try again.';

// Rate-limit copy tells the user to wait, which a generic "try again" would contradict.
export function actionErrorMessage(result: ActionResult<unknown> | null, fallback: string): string {
  return result && !result.ok && result.error.code === 'RateLimited'
    ? result.error.message
    : fallback;
}
