'use client';

import { useRef, useState, useTransition } from 'react';
import { ReportDialog } from '@/app/_components/report-dialog';
import { blockUserAction, unblockUserAction } from '../actions';
import { useRefreshAfter } from './use-refresh-after';

type ThreadMenuProps = {
  otherUserId: string;
  otherName: string;
  blocked: boolean;
};

export function ThreadMenu({ otherUserId, otherName, blocked }: ThreadMenuProps) {
  const refreshAfter = useRefreshAfter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const [reporting, setReporting] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);

  function run() {
    setFailed(false);
    startTransition(async () => {
      const action = blocked ? unblockUserAction : blockUserAction;
      const result = await refreshAfter(() => action(otherUserId)).catch(() => null);
      if (result?.ok) menu.current?.removeAttribute('open');
      else setFailed(true);
    });
  }

  return (
    <>
      <details ref={menu} className="relative">
        <summary
          ref={summary}
          className="cursor-pointer list-none rounded-md px-2 py-1 text-sm hover:bg-muted"
        >
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
          <button
            type="button"
            onClick={() => {
              menu.current?.removeAttribute('open');
              setReporting(true);
            }}
            className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
          >
            Report user
          </button>
          {failed && (
            <p role="alert" className="px-2 py-1 text-xs text-destructive">
              Something went wrong. Try again.
            </p>
          )}
        </div>
      </details>
      <ReportDialog
        open={reporting}
        onClose={() => {
          setReporting(false);
          summary.current?.focus();
        }}
        targetType="user"
        targetId={otherUserId}
        title={`Report ${otherName}`}
      />
    </>
  );
}
