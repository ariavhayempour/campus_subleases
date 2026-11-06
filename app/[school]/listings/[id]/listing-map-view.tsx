'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import { Building2 } from 'lucide-react';
import MapGL, { Marker, NavigationControl } from 'react-map-gl/mapbox';
import type { LngLat } from '@/lib/validation/listing';

type ListingMapViewProps = { token: string; listing: LngLat; campus: LngLat; campusName: string };

export default function ListingMapView({
  token,
  listing,
  campus,
  campusName,
}: ListingMapViewProps) {
  return (
    <MapGL
      mapboxAccessToken={token}
      initialViewState={{ longitude: listing.lng, latitude: listing.lat, zoom: 14 }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      scrollZoom={false}
      style={{ width: '100%', height: '100%' }}
    >
      <NavigationControl showCompass={false} />
      <Marker longitude={campus.lng} latitude={campus.lat} anchor="left" offset={[-15, 0]}>
        <span className="pointer-events-none flex items-center gap-1.5">
          <span className="grid size-[30px] place-items-center rounded-[2px] bg-ink text-white shadow-[0_0_0_3px_#fff]">
            <Building2 aria-hidden="true" className="size-4" />
          </span>
          <span className="varsity rounded-[2px] bg-white/95 px-1.5 pt-1 pb-[3px] text-[13px] font-extrabold tracking-[0.06em] text-ink">
            {campusName}
          </span>
        </span>
      </Marker>
      <Marker longitude={listing.lng} latitude={listing.lat} anchor="center">
        <span className="pointer-events-none block size-5 rounded-full border-[3px] border-white bg-school shadow-[0_0_0_2px_var(--school),0_2px_8px_rgb(0_0_0/0.3)]" />
      </Marker>
    </MapGL>
  );
}
