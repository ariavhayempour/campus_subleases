'use client';

import { useState, useTransition } from 'react';
import { loadMoreListingsAction } from '@/app/[school]/actions';
import { ListingTile } from '@/app/_components/listing-tile';
import { Button } from '@/components/ui/button';
import type { SearchPage } from '@/server/services/search';

type BrowseResultsProps = {
  schoolId: string;
  query: string;
  initial: SearchPage;
  signedIn: boolean;
  onHover?: (id: string | null) => void;
};

export function BrowseResults({ schoolId, query, initial, signedIn, onHover }: BrowseResultsProps) {
  const [cards, setCards] = useState(initial.cards);
  const [nextOffset, setNextOffset] = useState(initial.nextOffset);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function loadMore() {
    if (nextOffset === null) return;
    setError(null);
    startTransition(async () => {
      const result = await loadMoreListingsAction(schoolId, query, nextOffset);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      // Listings can shift between pages while browsing; skip any already shown.
      setCards((shown) => [
        ...shown,
        ...result.data.cards.filter((card) => !shown.some((s) => s.id === card.id)),
      ]);
      setNextOffset(result.data.nextOffset);
    });
  }

  return (
    <div>
      <ul className="grid gap-6 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.id}>
            <ListingTile card={card} signedIn={signedIn} onHover={onHover} />
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {nextOffset !== null && (
        <div className="mt-8 flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={pending}>
            {pending ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
