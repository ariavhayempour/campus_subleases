'use client';

import dynamic from 'next/dynamic';
import { useInView } from '@/app/_lib/use-in-view';
import type { LngLat } from '@/lib/validation/listing';

const placeholder = <div className="h-full w-full animate-pulse bg-surface-2" />;

// mapbox-gl touches `window` on import, so it only loads in the browser.
const ListingMapView = dynamic(() => import('./listing-map-view'), {
  ssr: false,
  loading: () => placeholder,
});

type ListingMapProps = { listing: LngLat; campus: LngLat; campusName: string };

export function ListingMap({ listing, campus, campusName }: ListingMapProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  // Each Mapbox map load is billed, so the map mounts only once it scrolls near the viewport.
  const [ref, inView] = useInView<HTMLDivElement>();
  if (!token) return null;
  return (
    <div ref={ref} className="aspect-[16/9] overflow-hidden rounded-md border border-line">
      {inView ? (
        <ListingMapView token={token} listing={listing} campus={campus} campusName={campusName} />
      ) : (
        placeholder
      )}
    </div>
  );
}
