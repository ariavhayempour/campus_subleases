'use client';

import { List, Map as MapIcon, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useMediaQuery } from '@/app/_lib/use-media-query';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LngLat } from '@/lib/validation/listing';
import { toSearchParams, type SearchFilters } from '@/lib/validation/search';
import type { MapPin, SearchPage } from '@/server/services/search';
import { BrowseMap } from './browse-map';
import { BrowseResults } from './browse-results';

type BrowseViewProps = {
  school: {
    id: string;
    slug: string;
    campus: LngLat;
    campusName: string;
    zoom: number;
    timelineStart: string;
  };
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
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [mobileView, setMobileView] = useState<'list' | 'map'>(filters.bounds ? 'map' : 'list');
  // Phones load Mapbox only once the map is first shown, then keep it mounted.
  const [mapRequested, setMapRequested] = useState(mobileView === 'map');
  // Latch on desktop too, so shrinking below 768px never unmounts (and later re-bills) the map.
  if (isDesktop && !mapRequested) setMapRequested(true);

  function navigate(next: SearchFilters) {
    const nextQuery = toSearchParams(next).toString();
    router.push(nextQuery ? `/${school.slug}?${nextQuery}` : `/${school.slug}`);
  }

  function toggleMobileView() {
    if (mobileView === 'list') setMapRequested(true);
    setMobileView(mobileView === 'list' ? 'map' : 'list');
  }

  function clearArea() {
    navigate({ ...filters, bounds: undefined });
  }

  return (
    <div className="mt-4">
      <div
        className={cn(
          'mb-4 flex flex-wrap items-center gap-3 text-sm',
          !filters.bounds && 'md:hidden',
        )}
      >
        {filters.bounds && (
          <p className="flex items-center gap-2 rounded-full bg-school-tint py-1.5 pr-1.5 pl-3.5 font-medium text-ink">
            Showing listings in the map area
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-[13px] font-semibold text-school-link ring-1 ring-line-2"
              onClick={clearArea}
            >
              <X aria-hidden="true" className="size-3.5" />
              Clear area
            </button>
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto md:hidden"
          onClick={toggleMobileView}
        >
          {mobileView === 'list' ? <MapIcon aria-hidden="true" /> : <List aria-hidden="true" />}
          {mobileView === 'list' ? 'Show map' : 'Show list'}
        </Button>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
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
              campusName={school.campusName}
              timelineStart={school.timelineStart}
              onHover={setHoveredId}
            />
          )}
        </div>
        <div
          className={cn(
            'h-[70dvh] md:sticky md:top-[5.25rem] md:h-[calc(100dvh-6.5rem)]',
            mobileView === 'list' && 'hidden md:block',
          )}
        >
          {isDesktop || mapRequested ? (
            <BrowseMap
              schoolSlug={school.slug}
              campus={school.campus}
              campusName={school.campusName}
              zoom={school.zoom}
              pins={pins}
              bounds={filters.bounds}
              hoveredId={hoveredId}
              onSearchArea={(bounds) => navigate({ ...filters, bounds })}
            />
          ) : (
            <div className="h-full w-full animate-pulse rounded-md bg-surface-2" />
          )}
        </div>
      </div>
    </div>
  );
}
