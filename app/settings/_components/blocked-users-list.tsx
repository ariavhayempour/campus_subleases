'use client';

import { useState, useTransition } from 'react';
import { LocalTime } from '@/app/_components/local-time';
import { Button } from '@/components/ui/button';
import { unblockFromSettingsAction } from '../actions';

export type BlockedUserRow = { id: string; displayName: string; blockedAt: string };

export function BlockedUsersList({ users }: { users: BlockedUserRow[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">You haven&apos;t blocked anyone.</p>;
  }

  function unblock(userId: string) {
    setFailed(false);
    setPendingId(userId);
    startTransition(async () => {
      const result = await unblockFromSettingsAction(userId).catch(() => null);
      if (!result?.ok) setFailed(true);
      setPendingId(null);
    });
  }

  return (
    <div>
      <ul className="divide-y rounded-lg border">
        {users.map((user) => (
          <li key={user.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <div>
              <p className="font-medium">{user.displayName}</p>
              <p className="text-xs text-muted-foreground">
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
      {failed && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Something went wrong. Try again.
        </p>
      )}
    </div>
  );
}
