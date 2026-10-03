'use client';

import type { ReactNode } from 'react';
import type { LngLat } from '@/lib/validation/listing';
import type { SearchFilters } from '@/lib/validation/search';
import type { SearchPage } from '@/server/services/search';
import { BrowseResults } from './browse-results';

type BrowseViewProps = {
  school: { id: string; slug: string; campus: LngLat; zoom: number };
  filters: SearchFilters;
  query: string;
  results: SearchPage;
  signedIn: boolean;
  empty: ReactNode;
};

export function BrowseView({ school, query, results, signedIn, empty }: BrowseViewProps) {
  return (
    <div className="mt-6">
      {results.cards.length === 0 ? (
        empty
      ) : (
        <BrowseResults
          key={query}
          schoolId={school.id}
          query={query}
          initial={results}
          signedIn={signedIn}
        />
      )}
    </div>
  );
}
