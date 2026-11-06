'use client';

import Link from 'next/link';
import { useIsCurrent } from '@/app/_components/header-nav';
import { useMessaging } from '@/app/_components/messaging-provider';

export function MessagesNavLink({ className }: { className?: string }) {
  const { unreadCount } = useMessaging();
  const isCurrent = useIsCurrent();
  return (
    <Link
      href="/messages"
      aria-label={unreadCount > 0 ? `Messages, ${unreadCount} unread` : undefined}
      aria-current={isCurrent('/messages') ? 'page' : undefined}
      className={className}
    >
      Messages
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="numeral min-w-[19px] rounded-full bg-highlight px-1.5 pt-0.5 text-center text-xs text-on-highlight"
        >
          {unreadCount}
        </span>
      )}
    </Link>
  );
}
