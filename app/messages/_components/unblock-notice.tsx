'use client';

import { useState, useTransition } from 'react';
import { unblockUserAction } from '../actions';
import { useRefreshAfter } from './use-refresh-after';

export function UnblockNotice({ otherUserId }: { otherUserId: string }) {
  const refreshAfter = useRefreshAfter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function unblock() {
    setFailed(false);
    startTransition(async () => {
      const result = await refreshAfter(() => unblockUserAction(otherUserId)).catch(() => null);
      if (!result?.ok) setFailed(true);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-2 px-5 py-3.5 text-sm text-ink">
      <p>You blocked this user</p>
      <button
        type="button"
        onClick={unblock}
        disabled={pending}
        className="h-9 rounded-md border border-line-2 bg-background px-3 font-semibold text-ink hover:border-ink-3 disabled:opacity-60"
      >
        Unblock
      </button>
      {failed && (
        <p role="alert" className="w-full text-xs text-bad">
          Something went wrong. Try again.
        </p>
      )}
    </div>
  );
}
