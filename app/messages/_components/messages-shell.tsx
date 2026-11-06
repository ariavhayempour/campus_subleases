'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type MessagesShellProps = { inbox: ReactNode; children: ReactNode };

// Sized to the viewport under the 64px header and its 8px school stripe, so only the panes scroll.
export function MessagesShell({ inbox, children }: MessagesShellProps) {
  const inThread = useSelectedLayoutSegment() !== null;
  return (
    <main className="mx-auto flex h-[calc(100dvh-4.5rem)] w-full max-w-7xl border-line lg:border-x">
      <aside
        className={cn(
          'flex w-full shrink-0 flex-col border-line md:flex md:w-[22.5rem] md:border-r',
          inThread && 'hidden',
        )}
      >
        <div className="flex items-baseline justify-between px-5 pt-5 pb-3">
          <h1 className="varsity text-[2rem] font-black">Messages</h1>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{inbox}</div>
      </aside>
      <section className={cn('min-w-0 flex-1 flex-col md:flex', inThread ? 'flex' : 'hidden')}>
        {inThread && (
          <Link
            href="/messages"
            className="flex items-center gap-1 border-b border-line px-4 py-2.5 text-sm font-semibold text-ink no-underline md:hidden"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            Back to messages
          </Link>
        )}
        <div className="min-h-0 flex-1">{children}</div>
      </section>
    </main>
  );
}
