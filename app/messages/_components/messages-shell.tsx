'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type MessagesShellProps = { inbox: ReactNode; children: ReactNode };

export function MessagesShell({ inbox, children }: MessagesShellProps) {
  const inThread = useSelectedLayoutSegment() !== null;
  return (
    <main className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-6xl border-x">
      <aside
        className={cn(
          'w-full shrink-0 overflow-y-auto border-r md:block md:w-80',
          inThread && 'hidden',
        )}
      >
        {inbox}
      </aside>
      <section className={cn('min-w-0 flex-1 flex-col md:flex', inThread ? 'flex' : 'hidden')}>
        {inThread && (
          <Link href="/messages" className="border-b px-4 py-2 text-sm underline md:hidden">
            Back to messages
          </Link>
        )}
        <div className="min-h-0 flex-1">{children}</div>
      </section>
    </main>
  );
}
