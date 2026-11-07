import { describe, expect, it } from 'vitest';
import { formatMessageTime } from '@/lib/format';
import { mergeMessages, withUnreadPrefix } from '@/lib/messages';
import type { MessageView } from '@/lib/messaging-options';

const m = (id: string, createdAt: string): MessageView => ({
  id,
  conversationId: 'c',
  senderId: 'u',
  body: id,
  createdAt,
});

describe('mergeMessages', () => {
  it('merges by id and sorts by time, then id', () => {
    const a = m('a', '2026-10-05T10:00:00.000Z');
    const b = m('b', '2026-10-05T10:00:01.000Z');
    const c = m('c', '2026-10-05T10:00:01.000Z');
    expect(mergeMessages([b], [c, a, b]).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns the same array when nothing is new', () => {
    const current = [m('a', '2026-10-05T10:00:00.000Z')];
    expect(mergeMessages(current, [current[0]])).toBe(current);
  });
});

describe('formatMessageTime', () => {
  it('formats message times relative to now', () => {
    const now = new Date(2026, 9, 5, 18, 0);
    expect(formatMessageTime(new Date(2026, 9, 5, 15, 7).toISOString(), now)).toBe('3:07 PM');
    expect(formatMessageTime(new Date(2026, 9, 4, 15, 7).toISOString(), now)).toBe(
      'Oct 4, 3:07 PM',
    );
    expect(formatMessageTime(new Date(2025, 11, 31, 9, 0).toISOString(), now)).toBe(
      'Dec 31, 2025, 9:00 AM',
    );
  });
});

describe('withUnreadPrefix', () => {
  it('adds, replaces, and removes the unread prefix', () => {
    expect(withUnreadPrefix('Messages · Student Subleases', 3)).toBe(
      '(3) Messages · Student Subleases',
    );
    expect(withUnreadPrefix('(3) Messages · Student Subleases', 1)).toBe(
      '(1) Messages · Student Subleases',
    );
    expect(withUnreadPrefix('(1) Messages · Student Subleases', 0)).toBe(
      'Messages · Student Subleases',
    );
  });
});
