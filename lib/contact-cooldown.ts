export const CONTACT_COOLDOWN_MS = 60_000;

const STORAGE_KEY = 'contact-last-sent';

// Storage can be missing or throw (private mode, blocked site data); then there is no cooldown.
export function cooldownRemaining(
  storage: Pick<Storage, 'getItem'> | null,
  now: number = Date.now(),
): number {
  try {
    const sentAt = Number(storage?.getItem(STORAGE_KEY));
    if (!Number.isFinite(sentAt) || sentAt <= 0) return 0;
    return Math.max(0, sentAt + CONTACT_COOLDOWN_MS - now);
  } catch {
    return 0;
  }
}

export function recordContactSent(
  storage: Pick<Storage, 'setItem'> | null,
  now: number = Date.now(),
): void {
  try {
    storage?.setItem(STORAGE_KEY, String(now));
  } catch {
    // Best effort: the cooldown only deters casual resubmits.
  }
}
