'use client';

import dynamic from 'next/dynamic';
import type { BrowseMapViewProps } from './browse-map-view';

// mapbox-gl touches `window` on import, so it only loads in the browser.
const BrowseMapView = dynamic(() => import('./browse-map-view'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-muted" />,
});

export function BrowseMap(props: Omit<BrowseMapViewProps, 'token'>) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground">
        Map unavailable
      </div>
    );
  }
  return <BrowseMapView token={token} {...props} />;
}
