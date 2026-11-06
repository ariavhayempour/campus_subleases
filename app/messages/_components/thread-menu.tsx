'use client';

import { Ban, Flag, MoreHorizontal, UserCheck } from 'lucide-react';
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
          className="grid size-9 cursor-pointer list-none place-items-center rounded-md text-ink hover:bg-surface-2 [&::-webkit-details-marker]:hidden"
        >
          <span className="sr-only">Conversation options</span>
          <MoreHorizontal aria-hidden="true" className="size-5" />
        </summary>
        <div className="absolute right-0 z-20 mt-1.5 w-52 rounded-md bg-background p-1.5 shadow-[0_8px_28px_rgb(0_0_0/0.18)] ring-1 ring-line">
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-sm text-bad hover:bg-surface-2 disabled:opacity-60"
          >
            {blocked ? (
              <UserCheck aria-hidden="true" className="size-4" />
            ) : (
              <Ban aria-hidden="true" className="size-4" />
            )}
            {blocked ? 'Unblock' : 'Block user'}
          </button>
          <button
            type="button"
            onClick={() => {
              menu.current?.removeAttribute('open');
              setReporting(true);
            }}
            className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-sm text-ink hover:bg-surface-2"
          >
            <Flag aria-hidden="true" className="size-4" />
            Report user
          </button>
          {failed && (
            <p role="alert" className="px-2.5 py-1 text-xs text-bad">
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
