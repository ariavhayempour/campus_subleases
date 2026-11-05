'use client';

import { useSyncExternalStore } from 'react';
import { formatMessageTime } from '@/lib/format';

const subscribe = () => () => undefined;

// Server and hydration render a placeholder; the viewer's zone is only known after mount.
export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <time dateTime={iso} className={className}>
      {mounted ? formatMessageTime(iso) : ' '}
    </time>
  );
}
