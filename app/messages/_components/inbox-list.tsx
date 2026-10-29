'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSelectedLayoutSegment } from 'next/navigation';
import { useEffect } from 'react';
import { useMessaging } from '@/app/_components/messaging-provider';
import { formatMessageTime } from '@/lib/format';
import { DELETED_USER_LABEL, REMOVED_LISTING_LABEL } from '@/lib/messaging-options';
import { cn } from '@/lib/utils';
import type { InboxRow } from '@/server/services/messaging-reads';

export function InboxList({ items }: { items: InboxRow[] }) {
  const openId = useSelectedLayoutSegment();
  const router = useRouter();
  const { onEvent, onResync } = useMessaging();

  useEffect(() => {
    const refresh = () => router.refresh();
    const offEvent = onEvent(refresh);
    const offResync = onResync(refresh);
    return () => {
      offEvent();
      offResync();
    };
  }, [onEvent, onResync, router]);
  if (items.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No messages yet. Message a host from any listing to start a conversation.
      </p>
    );
  }
  return (
    <nav aria-label="Conversations">
      <ul className="divide-y">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/messages/${item.id}`}
              aria-current={openId === item.id ? 'page' : undefined}
              className={cn(
                'flex gap-3 p-3 hover:bg-muted focus-visible:outline-2',
                openId === item.id && 'bg-muted',
              )}
            >
              <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                {item.listing?.coverThumbUrl && (
                  <Image
                    src={item.listing.coverThumbUrl}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn('truncate', item.unread ? 'font-semibold' : 'font-medium')}>
                    {item.listing?.title ?? REMOVED_LISTING_LABEL}
                  </span>
                  <time
                    dateTime={item.lastMessageAt}
                    suppressHydrationWarning
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    {formatMessageTime(item.lastMessageAt)}
                  </time>
                </div>
                <p className="truncate text-muted-foreground">
                  {item.otherUser?.displayName ?? DELETED_USER_LABEL}
                </p>
                <div className="flex items-center gap-2">
                  <p className="truncate">
                    {item.lastMessageFromMe && 'You: '}
                    {item.preview}
                  </p>
                  {item.unread && (
                    <span className="ml-auto size-2 shrink-0 rounded-full bg-primary">
                      <span className="sr-only">Unread</span>
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
