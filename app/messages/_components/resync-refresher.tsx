'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useMessaging } from '@/app/_components/messaging-provider';

// The one resync refresh for /messages; one refresh re-renders the inbox and the open thread.
export function ResyncRefresher(): null {
  const router = useRouter();
  const { onResync } = useMessaging();
  useEffect(() => onResync(() => router.refresh()), [onResync, router]);
  return null;
}
