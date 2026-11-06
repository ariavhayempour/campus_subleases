'use client';

import { useState, useTransition } from 'react';
import type { ActionResult } from '@/app/_lib/action-result';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ReviewStatus } from '@/lib/listing-options';
import { CONFIRM_WORD } from '@/lib/moderation-options';
import {
  approveAction,
  deleteListingAction,
  hideAction,
  rejectAction,
  unhideAction,
} from '../listings/actions';

type ReviewActionsProps = {
  listingId: string;
  version: string;
  reviewStatus: ReviewStatus;
  autoHidden: boolean;
};

type Failure = Extract<ActionResult<void>, { ok: false }>['error'];

export function ReviewActions({
  listingId,
  version,
  reviewStatus,
  autoHidden,
}: ReviewActionsProps) {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<Failure | null>(null);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState('');

  function run(action: () => Promise<ActionResult<void>>) {
    startTransition(async () => {
      const result = await action();
      // The action's revalidatePath re-renders this page with the new review state.
      setFailure(result.ok ? null : result.error);
    });
  }

  const fieldError = (name: string): string | undefined => failure?.fieldErrors?.[name]?.[0];

  return (
    <div className="space-y-5">
      {reviewStatus === 'pending' && (
        <div className="space-y-5">
          <Button
            size="lg"
            disabled={pending}
            className="w-full bg-ok text-white hover:bg-ok/90"
            onClick={() => run(() => approveAction(listingId, version))}
          >
            Approve
          </Button>
          <div className="space-y-2">
            <Label htmlFor="reject-note">Reason shown to the owner</Label>
            <textarea
              id="reject-note"
              rows={3}
              value={note}
              disabled={pending}
              onChange={(event) => setNote(event.target.value)}
              aria-invalid={fieldError('note') ? true : undefined}
              aria-describedby={fieldError('note') ? 'reject-note-error' : undefined}
              className="w-full rounded-md border border-line-2 bg-background px-3 py-2.5 text-sm text-ink hover:border-ink-3 focus-visible:border-school focus-visible:ring-3 focus-visible:ring-school/20 focus-visible:outline-none"
            />
            {fieldError('note') && (
              <p id="reject-note-error" className="text-sm text-bad">
                {fieldError('note')}
              </p>
            )}
            <Button
              variant="outline"
              disabled={pending}
              className="w-full"
              onClick={() => run(() => rejectAction(listingId, version, note))}
            >
              Reject
            </Button>
          </div>
        </div>
      )}
      {(reviewStatus === 'approved' || (reviewStatus === 'hidden' && autoHidden)) && (
        <Button
          variant="outline"
          disabled={pending}
          className="w-full"
          onClick={() => run(() => hideAction(listingId))}
        >
          {autoHidden ? 'Keep hidden' : 'Hide'}
        </Button>
      )}
      {reviewStatus === 'hidden' && (
        <Button
          variant="outline"
          disabled={pending}
          className="w-full"
          onClick={() => run(() => unhideAction(listingId))}
        >
          Unhide
        </Button>
      )}
      <div className="space-y-2 border-t border-line pt-5">
        <Label htmlFor="delete-confirm">Type {CONFIRM_WORD} to confirm</Label>
        <Input
          id="delete-confirm"
          value={confirm}
          disabled={pending}
          autoComplete="off"
          onChange={(event) => setConfirm(event.target.value)}
          aria-invalid={fieldError('confirm') ? true : undefined}
          aria-describedby={fieldError('confirm') ? 'delete-confirm-error' : undefined}
        />
        {fieldError('confirm') && (
          <p id="delete-confirm-error" className="text-sm text-bad">
            {fieldError('confirm')}
          </p>
        )}
        <Button
          variant="destructive"
          disabled={pending}
          className="w-full bg-bad-bg text-bad hover:bg-bad hover:text-white"
          onClick={() => run(() => deleteListingAction(listingId, confirm))}
        >
          Delete listing
        </Button>
      </div>
      {failure && !failure.fieldErrors && (
        <p role="alert" className="text-sm text-bad">
          {failure.message}
          {failure.code === 'Conflict' && (
            <>
              {' '}
              {/* A plain anchor forces a hard reload so the new version token is fetched. */}
              <a href="" className="underline">
                Reload
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
