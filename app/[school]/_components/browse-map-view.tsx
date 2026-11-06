'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import { Building2, Search } from 'lucide-react';
import type {
  GeoJSONFeature,
  GeoJSONSource,
  GeoJSONSourceSpecification,
  Map as MapboxMap,
  SymbolLayerSpecification,
} from 'mapbox-gl';
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
  campusName: string;
  zoom: number;
  pins: MapPin[];
  bounds?: Bounds;
  hoveredId: string | null;
  onSearchArea: (bounds: Bounds) => void;
};

const SOURCE_ID = 'listings';
const PIN_IMAGE = 'rent-pill';
const HOT_PIN_IMAGE = 'rent-pill-hot';
const PIN_FONT = ['DIN Pro Bold', 'Arial Unicode MS Bold'];

type PinColors = { pin: string; onPin: string; hot: string; onHot: string };

// Mapbox paints in WebGL, so the school colors are read from the page's CSS variables.
function readPinColors(): PinColors {
  const css = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    pin: read('--school', '#15171c'),
    onPin: read('--on-school', '#ffffff'),
    hot: read('--school-highlight', '#15171c'),
    onHot: read('--on-school-highlight', '#ffffff'),
  };
}

const PILL_W = 24;
const PILL_BODY = 22;
const PILL_H = 28;
const RATIO = 2;

// A rounded tag with a pointer; the stretch zones skip the pointer so it stays centered.
function addPillImage(map: MapboxMap, id: string, fill: string) {
  const canvas = document.createElement('canvas');
  canvas.width = PILL_W * RATIO;
  canvas.height = PILL_H * RATIO;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  ctx.scale(RATIO, RATIO);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(0, 0, PILL_W, PILL_BODY, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(PILL_W / 2 - 5, PILL_BODY - 1);
  ctx.lineTo(PILL_W / 2, PILL_H);
  ctx.lineTo(PILL_W / 2 + 5, PILL_BODY - 1);
  ctx.fill();
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (map.hasImage(id)) map.updateImage(id, { width: canvas.width, height: canvas.height, data });
  else
    map.addImage(
      id,
      { width: canvas.width, height: canvas.height, data },
      {
        pixelRatio: RATIO,
        stretchX: [
          [4 * RATIO, 6 * RATIO],
          [18 * RATIO, 20 * RATIO],
        ],
        stretchY: [[6 * RATIO, 16 * RATIO]],
        content: [4 * RATIO, 3 * RATIO, 20 * RATIO, 19 * RATIO],
      },
    );
}

function shortRent(rentCents: number): string {
  const dollars = Math.round(rentCents / 100);
  if (dollars < 1000) return `$${dollars}`;
  const thousands = dollars / 1000;
  const rounded =
    thousands >= 10 ? String(Math.round(thousands)) : String(Number(thousands.toFixed(1)));
  return `$${rounded}k`;
}

const PIN_LAYOUT: NonNullable<SymbolLayerSpecification['layout']> = {
  'icon-text-fit': 'both',
  'icon-text-fit-padding': [3, 7, 9, 7],
  'icon-anchor': 'bottom',
  'icon-allow-overlap': true,
  'text-allow-overlap': true,
  'text-field': ['get', 'label'],
  'text-font': PIN_FONT,
  'text-size': 13,
  'text-anchor': 'bottom',
  'text-offset': [0, -0.75],
};

// GeoJSONFeature extends the GeoJSON namespace, which is not installed, so `properties` is untyped.
function propertiesOf(feature: GeoJSONFeature): Record<string, unknown> {
  return (feature as { properties?: Record<string, unknown> | null }).properties ?? {};
}

export default function BrowseMapView({
  token,
  schoolSlug,
  campus,
  campusName,
  zoom,
  pins,
  bounds,
  hoveredId,
  onSearchArea,
}: BrowseMapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [moved, setMoved] = useState(false);
  const [colors, setColors] = useState<PinColors | null>(null);
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
        properties: { id: pin.id, label: shortRent(pin.rentCents) },
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

  // Pin layers mount only after their images exist, so they never render as missing images.
  function handleLoad() {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const next = readPinColors();
    addPillImage(map, PIN_IMAGE, next.pin);
    addPillImage(map, HOT_PIN_IMAGE, next.hot);
    setColors(next);
  }

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

  const dim = hoveredId ? 0.35 : 1;

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full overflow-hidden rounded-md border border-line"
    >
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
        onLoad={handleLoad}
        onClick={handleClick}
        onMoveEnd={handleMoveEnd}
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
        {colors && (
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
                'circle-color': colors.pin,
                'circle-opacity': dim,
                'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
                'circle-stroke-width': 3,
                'circle-stroke-color': '#ffffff',
              }}
            />
            <Layer
              id="cluster-count"
              type="symbol"
              filter={['has', 'point_count']}
              layout={{
                'text-field': ['get', 'point_count_abbreviated'],
                'text-font': PIN_FONT,
                'text-size': 13,
              }}
              paint={{ 'text-color': colors.onPin, 'text-opacity': dim }}
            />
            <Layer
              id="pins"
              type="symbol"
              filter={['!', ['has', 'point_count']]}
              layout={{ ...PIN_LAYOUT, 'icon-image': PIN_IMAGE }}
              paint={{ 'text-color': colors.onPin, 'icon-opacity': dim, 'text-opacity': dim }}
            />
            <Layer
              id="pin-hovered"
              type="symbol"
              filter={[
                'all',
                ['!', ['has', 'point_count']],
                ['==', ['get', 'id'], hoveredId ?? ''],
              ]}
              layout={{ ...PIN_LAYOUT, 'icon-image': HOT_PIN_IMAGE, 'text-size': 14 }}
              paint={{
                'text-color': colors.onHot,
                'icon-translate': [0, -6],
                'text-translate': [0, -6],
              }}
            />
          </Source>
        )}
        {selection && selected.length > 0 && (
          <Popup
            longitude={selection.lng}
            latitude={selection.lat}
            onClose={() => setSelection(null)}
            closeOnClick={false}
            maxWidth="240px"
          >
            {selected.length === 1 ? (
              <Link
                href={`/${schoolSlug}/listings/${selected[0].id}`}
                className="block w-52 text-ink no-underline hover:underline"
              >
                {selected[0].coverThumbUrl && (
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[3px] bg-surface-2">
                    <Image
                      src={selected[0].coverThumbUrl}
                      alt=""
                      fill
                      sizes="208px"
                      className="object-cover"
                    />
                  </div>
                )}
                <p className="numeral mt-2 text-[1.375rem]">{formatRent(selected[0].rentCents)}</p>
                <p className="truncate text-sm font-semibold">{selected[0].title}</p>
              </Link>
            ) : (
              <div className="w-52">
                <p className="varsity text-base font-extrabold text-ink">
                  {selected.length} listings here
                </p>
                <ul className="mt-1 max-h-60 overflow-y-auto">
                  {selected.map((pin) => (
                    <li key={pin.id}>
                      <Link
                        href={`/${schoolSlug}/listings/${pin.id}`}
                        className="block py-1 text-ink no-underline hover:underline"
                      >
                        <span className="numeral text-lg">{formatRent(pin.rentCents)}</span>
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
          variant="outline"
          onClick={searchArea}
          className="absolute top-3 left-1/2 -translate-x-1/2 shadow-[0_2px_10px_rgb(0_0_0/0.18)]"
        >
          <Search aria-hidden="true" />
          Search this area
        </Button>
      )}
    </div>
  );
}
