'use client';

import { actionErrorMessage, GENERIC_FAILURE } from '@/app/_lib/action-message';
import { useState, useTransition } from 'react';
import { LocalTime } from '@/app/_components/local-time';
import { Button } from '@/components/ui/button';
import { unblockFromSettingsAction } from '../actions';

export type BlockedUserRow = { id: string; displayName: string; blockedAt: string };

export function BlockedUsersList({ users }: { users: BlockedUserRow[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (users.length === 0) {
    return <p className="text-sm text-ink-2">You haven&apos;t blocked anyone.</p>;
  }

  function unblock(userId: string) {
    setError(null);
    setPendingId(userId);
    startTransition(async () => {
      const result = await unblockFromSettingsAction(userId).catch(() => null);
      if (!result?.ok) setError(actionErrorMessage(result, GENERIC_FAILURE));
      setPendingId(null);
    });
  }

  return (
    <div>
      <ul className="divide-y divide-line rounded-md border border-line">
        {users.map((user) => (
          <li key={user.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <div>
              <p className="font-semibold text-ink">{user.displayName}</p>
              <p className="text-xs text-ink-2">
                Blocked <LocalTime iso={user.blockedAt} dateOnly />
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending && pendingId === user.id}
              onClick={() => unblock(user.id)}
            >
              Unblock
            </Button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
