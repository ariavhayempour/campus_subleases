'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import type { GeoJSONFeature, GeoJSONSource, GeoJSONSourceSpecification } from 'mapbox-gl';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import MapGL, {
  Layer,
  Marker,
  NavigationControl,
  Popup,
  Source,
  type MapMouseEvent,
  type MapRef,
  type ViewStateChangeEvent,
} from 'react-map-gl/mapbox';
import { Button } from '@/components/ui/button';
import { formatRent } from '@/lib/format';
import type { LngLat } from '@/lib/validation/listing';
import { clampBounds, roundBounds, type Bounds } from '@/lib/validation/search';
import type { MapPin } from '@/server/services/search';

export type BrowseMapViewProps = {
  token: string;
  schoolSlug: string;
  campus: LngLat;
  zoom: number;
  pins: MapPin[];
  bounds?: Bounds;
  hoveredId: string | null;
  onSearchArea: (bounds: Bounds) => void;
};

const SOURCE_ID = 'listings';
const PIN_COLOR = '#e11d48';

// GeoJSONFeature extends the GeoJSON namespace, which is not installed, so `properties` is untyped.
function propertiesOf(feature: GeoJSONFeature): Record<string, unknown> {
  return (feature as { properties?: Record<string, unknown> | null }).properties ?? {};
}

export default function BrowseMapView({
  token,
  schoolSlug,
  campus,
  zoom,
  pins,
  bounds,
  hoveredId,
  onSearchArea,
}: BrowseMapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [moved, setMoved] = useState(false);
  const [selection, setSelection] = useState<{ ids: string[]; lng: number; lat: number } | null>(
    null,
  );

  // The mobile map pane mounts hidden, so mapbox must re-measure when it is shown.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(() => mapRef.current?.resize());
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  const data = useMemo<GeoJSONSourceSpecification['data']>(
    () => ({
      type: 'FeatureCollection',
      features: pins.map((pin) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [pin.location.lng, pin.location.lat] },
        properties: { id: pin.id },
      })),
    }),
    [pins],
  );

  // Looked up against current pins so a popup never outlives a filter change.
  const selected = selection
    ? selection.ids.flatMap((id) => pins.find((pin) => pin.id === id) ?? [])
    : [];
  // A selection whose listings were all filtered out must not reopen when they return.
  if (selection && selected.length === 0) setSelection(null);

  function handleClick(event: MapMouseEvent) {
    const feature = event.features?.[0];
    if (!feature) {
      setSelection(null);
      return;
    }
    const clusterId: unknown = propertiesOf(feature).cluster_id;
    if (typeof clusterId === 'number') {
      const map = mapRef.current?.getMap();
      const source = map?.getSource<GeoJSONSource>(SOURCE_ID);
      source?.getClusterExpansionZoom(clusterId, (error, nextZoom) => {
        if (!error && typeof nextZoom === 'number') {
          map?.easeTo({ center: event.lngLat, zoom: nextZoom });
        }
      });
      return;
    }
    const ids: string[] = [];
    for (const hit of event.features ?? []) {
      const props = propertiesOf(hit);
      if (
        props.cluster_id === undefined &&
        typeof props.id === 'string' &&
        !ids.includes(props.id)
      ) {
        ids.push(props.id);
      }
    }
    const anchor = pins.find((pin) => pin.id === ids[0]);
    setSelection(anchor ? { ids, lng: anchor.location.lng, lat: anchor.location.lat } : null);
  }

  // Only user gestures carry an originalEvent; programmatic easeTo calls do not.
  function handleMoveEnd(event: ViewStateChangeEvent) {
    if ('originalEvent' in event && event.originalEvent) setMoved(true);
  }

  function searchArea() {
    const visible = mapRef.current?.getMap().getBounds();
    if (!visible) return;
    setMoved(false);
    setSelection(null);
    onSearchArea(
      roundBounds(
        clampBounds({
          west: visible.getWest(),
          south: visible.getSouth(),
          east: visible.getEast(),
          north: visible.getNorth(),
        }),
      ),
    );
  }

  return (
    <div ref={wrapperRef} className="relative h-full w-full overflow-hidden rounded-xl border">
      <MapGL
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={
          bounds
            ? {
                bounds: [
                  [bounds.west, bounds.south],
                  [bounds.east, bounds.north],
                ],
              }
            : { longitude: campus.lng, latitude: campus.lat, zoom }
        }
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: '100%', height: '100%' }}
        interactiveLayerIds={['clusters', 'pins']}
        onClick={handleClick}
        onMoveEnd={handleMoveEnd}
      >
        <NavigationControl showCompass={false} />
        <Marker longitude={campus.lng} latitude={campus.lat} color="#1d4ed8" />
        <Source
          id={SOURCE_ID}
          type="geojson"
          data={data}
          cluster
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer
            id="clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': PIN_COLOR,
              'circle-opacity': 0.85,
              'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
            }}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{ 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 }}
            paint={{ 'text-color': '#ffffff' }}
          />
          <Layer
            id="pins"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-color': PIN_COLOR,
              'circle-radius': 7,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            }}
          />
          <Layer
            id="pin-hovered"
            type="circle"
            filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], hoveredId ?? '']]}
            paint={{
              'circle-color': '#111827',
              'circle-radius': 10,
              'circle-stroke-width': 3,
              'circle-stroke-color': '#ffffff',
            }}
          />
        </Source>
        {selection && selected.length > 0 && (
          <Popup
            longitude={selection.lng}
            latitude={selection.lat}
            onClose={() => setSelection(null)}
            closeOnClick={false}
            maxWidth="240px"
          >
            {selected.length === 1 ? (
              <Link href={`/${schoolSlug}/listings/${selected[0].id}`} className="block w-52">
                {selected[0].coverThumbUrl && (
                  <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
                    <Image
                      src={selected[0].coverThumbUrl}
                      alt=""
                      fill
                      sizes="208px"
                      className="object-cover"
                    />
                  </div>
                )}
                <p className="mt-1 font-semibold">{formatRent(selected[0].rentCents)}</p>
                <p className="truncate text-sm">{selected[0].title}</p>
              </Link>
            ) : (
              <div className="w-52">
                <p className="text-sm font-semibold">{selected.length} listings here</p>
                <ul className="mt-1 max-h-60 overflow-y-auto">
                  {selected.map((pin) => (
                    <li key={pin.id}>
                      <Link
                        href={`/${schoolSlug}/listings/${pin.id}`}
                        className="block py-1 hover:underline"
                      >
                        <span className="font-semibold">{formatRent(pin.rentCents)}</span>
                        <span className="block truncate text-sm">{pin.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Popup>
        )}
      </MapGL>
      {moved && (
        <Button
          size="sm"
          onClick={searchArea}
          className="absolute left-1/2 top-3 -translate-x-1/2 shadow"
        >
          Search this area
        </Button>
      )}
    </div>
  );
}
