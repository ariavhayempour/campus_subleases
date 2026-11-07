import { describe, expect, it } from 'vitest';
import { clientIp } from '@/lib/client-ip';

describe('clientIp', () => {
  it('prefers x-real-ip', () => {
    const headers = new Headers({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.1.1.1' });
    expect(clientIp(headers)).toBe('9.9.9.9');
  });

  it('falls back to the first x-forwarded-for entry', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': ' 1.1.1.1 , 2.2.2.2' }))).toBe('1.1.1.1');
  });

  it('is undefined without either header', () => {
    expect(clientIp(new Headers())).toBeUndefined();
  });
});
