'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { ActionResult } from '@/app/_lib/action-result';
import { Button } from '@/components/ui/button';
import type { ListingStatus, ReviewStatus } from '@/lib/listing-options';
import { deleteListingAction, setListingStatusAction } from './actions';

type ListingRowActionsProps = {
  listingId: string;
  status: ListingStatus;
  reviewStatus: ReviewStatus;
};

export function ListingRowActions({ listingId, status, reviewStatus }: ListingRowActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<ActionResult<void>>) {
    startTransition(async () => {
      const result = await action();
      setError(result.ok ? null : result.error.message);
    });
  }

  function confirmDelete() {
    if (window.confirm('Delete this listing permanently? This can’t be undone.')) {
      run(() => deleteListingAction(listingId));
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/listings/${listingId}/edit`}>
            {reviewStatus === 'rejected' ? 'Edit and resubmit' : 'Edit'}
          </Link>
        </Button>
        {status === 'active' ? (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => setListingStatusAction(listingId, 'taken'))}
            >
              Mark as taken
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => setListingStatusAction(listingId, 'removed'))}
            >
              Remove
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => setListingStatusAction(listingId, 'active'))}
          >
            Reactivate
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-bad hover:bg-bad-bg hover:text-bad"
          disabled={pending}
          onClick={confirmDelete}
        >
          Delete
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
