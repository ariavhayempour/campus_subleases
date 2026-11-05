'use client';

import { useSyncExternalStore } from 'react';
import { formatMessageTime } from '@/lib/format';

const subscribe = () => () => undefined;

const localDay = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

type LocalTimeProps = { iso: string; className?: string; dateOnly?: boolean };

// Server and hydration render a placeholder; the viewer's zone is only known after mount.
export function LocalTime({ iso, className, dateOnly = false }: LocalTimeProps) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const text = dateOnly ? localDay.format(new Date(iso)) : formatMessageTime(iso);
  return (
    <time dateTime={iso} className={className}>
      {mounted ? text : ' '}
    </time>
  );
}
