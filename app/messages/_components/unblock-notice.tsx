'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { unblockUserAction } from '../actions';

export function UnblockNotice({ otherUserId }: { otherUserId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function unblock() {
    setFailed(false);
    startTransition(async () => {
      const result = await unblockUserAction(otherUserId).catch(() => null);
      if (result?.ok) router.refresh();
      else setFailed(true);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-sm">
      <p>You blocked this user</p>
      <button
        type="button"
        onClick={unblock}
        disabled={pending}
        className="rounded-lg border px-3 py-1.5 hover:bg-muted disabled:opacity-60"
      >
        Unblock
      </button>
      {failed && (
        <p role="alert" className="w-full text-xs text-destructive">
          Something went wrong. Try again.
        </p>
      )}
    </div>
  );
}
