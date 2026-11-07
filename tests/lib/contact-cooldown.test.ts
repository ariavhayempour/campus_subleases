import { describe, expect, it } from 'vitest';
import { CONTACT_COOLDOWN_MS, cooldownRemaining, recordContactSent } from '@/lib/contact-cooldown';

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

const throwing: Pick<Storage, 'getItem' | 'setItem'> = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('contact cooldown', () => {
  it('counts down 60 seconds from the last send', () => {
    const storage = memoryStorage();
    recordContactSent(storage, 1_000_000);
    expect(CONTACT_COOLDOWN_MS).toBe(60_000);
    expect(cooldownRemaining(storage, 1_000_000)).toBe(60_000);
    expect(cooldownRemaining(storage, 1_059_000)).toBe(1_000);
    expect(cooldownRemaining(storage, 1_060_000)).toBe(0);
  });

  it('is zero with nothing recorded or a garbage value', () => {
    const storage = memoryStorage();
    expect(cooldownRemaining(storage, 1_000_000)).toBe(0);
    storage.setItem('contact-last-sent', 'not-a-number');
    expect(cooldownRemaining(storage, 1_000_000)).toBe(0);
  });

  it('is zero and never throws when storage is unavailable', () => {
    expect(cooldownRemaining(null, 1_000_000)).toBe(0);
    expect(cooldownRemaining(throwing, 1_000_000)).toBe(0);
    expect(() => recordContactSent(throwing, 1_000_000)).not.toThrow();
    expect(() => recordContactSent(null, 1_000_000)).not.toThrow();
  });
});
