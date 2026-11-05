'use client';

import { useState, useTransition } from 'react';
import type { ActionResult } from '@/app/_lib/action-result';
import { Button } from '@/components/ui/button';
import { banAction, unbanAction } from '../users/actions';

type BanControlsProps = { userId: string; displayName: string; banned: boolean };

export function BanControls({ userId, displayName, banned }: BanControlsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(): void {
    const message = banned
      ? `Unban ${displayName}?`
      : `Ban ${displayName}? They will be signed out and their listings hidden.`;
    if (!window.confirm(message)) return;
    startTransition(async () => {
      const result: ActionResult<void> = await (banned ? unbanAction : banAction)(userId);
      // The action's revalidatePath re-renders this page with the new status.
      setError(result.ok ? null : result.error.message);
    });
  }

  return (
    <div className="space-y-2">
      <Button variant={banned ? 'outline' : 'destructive'} disabled={pending} onClick={run}>
        {banned ? 'Unban user' : 'Ban user'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
