'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import MapGL, { Marker, NavigationControl } from 'react-map-gl/mapbox';
import type { LngLat } from '@/lib/validation/listing';

type ListingMapViewProps = { token: string; listing: LngLat; campus: LngLat };

export default function ListingMapView({ token, listing, campus }: ListingMapViewProps) {
  return (
    <MapGL
      mapboxAccessToken={token}
      initialViewState={{ longitude: listing.lng, latitude: listing.lat, zoom: 14 }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      scrollZoom={false}
      style={{ width: '100%', height: '100%' }}
    >
      <NavigationControl showCompass={false} />
      <Marker longitude={campus.lng} latitude={campus.lat} color="#1d4ed8" />
      <Marker longitude={listing.lng} latitude={listing.lat} color="#e11d48" />
    </MapGL>
  );
}
