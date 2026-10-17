'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { blockUserAction, unblockUserAction } from '../actions';

type ThreadMenuProps = { otherUserId: string; blocked: boolean };

export function ThreadMenu({ otherUserId, blocked }: ThreadMenuProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);

  function run() {
    setFailed(false);
    startTransition(async () => {
      const action = blocked ? unblockUserAction : blockUserAction;
      const result = await action(otherUserId).catch(() => null);
      if (result?.ok) {
        menu.current?.removeAttribute('open');
        router.refresh();
      } else setFailed(true);
    });
  }

  return (
    <details ref={menu} className="relative">
      <summary className="cursor-pointer list-none rounded-md px-2 py-1 text-sm hover:bg-muted">
        <span className="sr-only">Conversation options</span>
        <span aria-hidden>⋯</span>
      </summary>
      <div className="absolute right-0 z-10 mt-1 w-40 rounded-md bg-background p-1 shadow-md ring-1 ring-border">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-60"
        >
          {blocked ? 'Unblock' : 'Block user'}
        </button>
        {failed && (
          <p role="alert" className="px-2 py-1 text-xs text-destructive">
            Something went wrong. Try again.
          </p>
        )}
      </div>
    </details>
  );
}
