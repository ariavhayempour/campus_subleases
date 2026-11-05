'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LngLat } from '@/lib/validation/listing';
import { toSearchParams, type SearchFilters } from '@/lib/validation/search';
import type { MapPin, SearchPage } from '@/server/services/search';
import { BrowseMap } from './browse-map';
import { BrowseResults } from './browse-results';

type BrowseViewProps = {
  school: { id: string; slug: string; campus: LngLat; zoom: number };
  filters: SearchFilters;
  query: string;
  results: SearchPage;
  pins: MapPin[];
  signedIn: boolean;
  empty: ReactNode;
};

export function BrowseView({
  school,
  filters,
  query,
  results,
  pins,
  signedIn,
  empty,
}: BrowseViewProps) {
  const router = useRouter();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');

  function navigate(next: SearchFilters) {
    const nextQuery = toSearchParams(next).toString();
    router.push(nextQuery ? `/${school.slug}?${nextQuery}` : `/${school.slug}`);
  }

  function clearArea() {
    navigate({ ...filters, bounds: undefined });
  }

  return (
    <div className="mt-4">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        {filters.bounds && (
          <p className="flex items-center gap-2 rounded-full border px-3 py-1">
            Showing listings in the map area
            <button type="button" className="underline" onClick={clearArea}>
              Clear area
            </button>
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto md:hidden"
          onClick={() => setMobileView((view) => (view === 'list' ? 'map' : 'list'))}
        >
          {mobileView === 'list' ? 'Show map' : 'Show list'}
        </Button>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className={cn(mobileView === 'map' && 'hidden md:block')}>
          {results.cards.length === 0 ? (
            empty
          ) : (
            <BrowseResults
              key={query}
              schoolId={school.id}
              query={query}
              initial={results}
              signedIn={signedIn}
              onHover={setHoveredId}
            />
          )}
        </div>
        <div
          className={cn(
            'h-[70dvh] md:sticky md:top-4 md:h-[calc(100dvh-6rem)]',
            mobileView === 'list' && 'hidden md:block',
          )}
        >
          <BrowseMap
            schoolSlug={school.slug}
            campus={school.campus}
            zoom={school.zoom}
            pins={pins}
            bounds={filters.bounds}
            hoveredId={hoveredId}
            onSearchArea={(bounds) => navigate({ ...filters, bounds })}
          />
        </div>
      </div>
    </div>
  );
}
