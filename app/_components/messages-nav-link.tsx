'use client';

import Link from 'next/link';
import { useMessaging } from '@/app/_components/messaging-provider';

export function MessagesNavLink() {
  const { unreadCount } = useMessaging();
  return (
    <Link
      href="/messages"
      aria-label={unreadCount > 0 ? `Messages, ${unreadCount} unread` : undefined}
      className="flex items-center gap-1.5 hover:underline"
    >
      Messages
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground"
        >
          {unreadCount}
        </span>
      )}
    </Link>
  );
}
