'use client';

import dynamic from 'next/dynamic';
import type { LngLat } from '@/lib/validation/listing';

// mapbox-gl touches `window` on import, so it only loads in the browser.
const ListingMapView = dynamic(() => import('./listing-map-view'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

type ListingMapProps = { listing: LngLat; campus: LngLat; campusName: string };

export function ListingMap({ listing, campus, campusName }: ListingMapProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  return (
    <div className="aspect-[16/9] overflow-hidden rounded-md border border-line">
      <ListingMapView token={token} listing={listing} campus={campus} campusName={campusName} />
    </div>
  );
}
