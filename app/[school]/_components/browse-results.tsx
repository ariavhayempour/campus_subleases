'use client';

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { loadMoreListingsAction } from '@/app/[school]/actions';
import { ListingTile } from '@/app/_components/listing-tile';
import { Button } from '@/components/ui/button';
import type { ListingCard } from '@/server/services/listing-cards';
import type { SearchPage } from '@/server/services/search';

type BrowseResultsProps = {
  schoolId: string;
  query: string;
  initial: SearchPage;
  signedIn: boolean;
  onHover?: (id: string | null) => void;
};

type Loaded = { count: number; height: number };

const LOAD_ERROR = 'Could not load more listings. Try again.';

// Storage can be blocked or full; the list then simply starts at the first page.
function readLoaded(key: string): Loaded | null {
  try {
    const [count, height] = (sessionStorage.getItem(key) ?? '').split(':').map(Number);
    return Number.isInteger(count) && Number.isFinite(height) ? { count, height } : null;
  } catch {
    return null;
  }
}

function writeLoaded(key: string, loaded: Loaded): void {
  try {
    sessionStorage.setItem(key, `${loaded.count}:${loaded.height}`);
  } catch {
    // Nothing to restore later.
  }
}

// Listings can shift between pages while browsing; skip any already shown.
const appendNew = (shown: ListingCard[], more: ListingCard[]): ListingCard[] => [
  ...shown,
  ...more.filter((card) => !shown.some((s) => s.id === card.id)),
];

export function BrowseResults({ schoolId, query, initial, signedIn, onHover }: BrowseResultsProps) {
  const [cards, setCards] = useState(initial.cards);
  const [nextOffset, setNextOffset] = useState(initial.nextOffset);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLUListElement>(null);
  const restoreStarted = useRef(false);
  const storageKey = `browse-loaded:${schoolId}:${query}`;

  // Reserves the remembered height before the browser restores scroll on Back.
  useLayoutEffect(() => {
    const list = listRef.current;
    const loaded = readLoaded(storageKey);
    if (!list || !loaded || loaded.count <= initial.cards.length) return;
    list.style.minHeight = `${loaded.height}px`;
  }, [storageKey, initial.cards.length]);

  useEffect(() => {
    if (restoreStarted.current) return;
    restoreStarted.current = true;
    const target = readLoaded(storageKey)?.count ?? 0;
    if (target <= initial.cards.length) return;
    startTransition(async () => {
      let shown = initial.cards;
      let offset = initial.nextOffset;
      while (offset !== null && shown.length < target) {
        const result = await loadMoreListingsAction(schoolId, query, offset).catch(() => null);
        if (!result?.ok || result.data.cards.length === 0) break;
        shown = appendNew(shown, result.data.cards);
        offset = result.data.nextOffset;
      }
      // Always a new array, so the effect below settles the list even when nothing was added.
      setCards([...shown]);
      setNextOffset(offset);
    });
  }, [storageKey, schoolId, query, initial]);

  // The initial page is never remembered, so a search only restores after "Load more".
  useEffect(() => {
    const list = listRef.current;
    if (!list || cards === initial.cards) return;
    list.style.minHeight = '';
    writeLoaded(storageKey, { count: cards.length, height: list.offsetHeight });
  }, [cards, storageKey, initial.cards]);

  function loadMore() {
    if (nextOffset === null) return;
    setError(null);
    startTransition(async () => {
      const result = await loadMoreListingsAction(schoolId, query, nextOffset).catch(() => null);
      if (!result) {
        setError(LOAD_ERROR);
        return;
      }
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setCards((shown) => appendNew(shown, result.data.cards));
      setNextOffset(result.data.nextOffset);
    });
  }

  return (
    <div>
      <ul ref={listRef} className="grid content-start gap-6 sm:grid-cols-2">
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
