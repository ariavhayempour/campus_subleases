import { formatDate } from '@/lib/format';
import {
  AMENITY_LABELS,
  GENDER_PREFERENCE_LABELS,
  LISTING_TYPE_LABELS,
} from '@/lib/listing-options';
import { bedroomOptionLabel } from '@/lib/search-options';
import type { SearchFilters } from '@/lib/validation/search';

export type ActiveFilterChip = { key: string; label: string; without: SearchFilters };

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const omit = (filters: SearchFilters, ...keys: (keyof SearchFilters)[]): SearchFilters => {
  const next = { ...filters };
  for (const key of keys) delete next[key];
  return next;
};

// One removable chip per active filter, in the order the filter bar shows them.
export function activeFilterChips(filters: SearchFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  const add = (key: string, label: string, without: SearchFilters) =>
    chips.push({ key, label, without });
  const { rentMin: min, rentMax: max, from, to } = filters;

  if (filters.q) add('q', `“${filters.q}”`, omit(filters, 'q'));
  if (min !== undefined || max !== undefined) {
    const label =
      min !== undefined && max !== undefined
        ? `${usd.format(min)}–${usd.format(max)}`
        : min !== undefined
          ? `${usd.format(min)}+`
          : `Up to ${usd.format(max ?? 0)}`;
    add('rent', label, omit(filters, 'rentMin', 'rentMax'));
  }
  if (from || to) {
    const label =
      from && to
        ? `${formatDate(from)} – ${formatDate(to)}`
        : from
          ? `From ${formatDate(from)}`
          : `Until ${formatDate(to ?? '')}`;
    add('dates', label, omit(filters, 'from', 'to'));
  }
  if (filters.bedrooms !== undefined) {
    add('beds', bedroomOptionLabel(filters.bedrooms), omit(filters, 'bedrooms'));
  }
  if (filters.type) add('type', LISTING_TYPE_LABELS[filters.type], omit(filters, 'type'));
  if (filters.furnished) add('furnished', 'Furnished', omit(filters, 'furnished'));
  if (filters.privateBathroom) {
    add('privateBath', 'Private bathroom', omit(filters, 'privateBathroom'));
  }
  if (filters.maxRoommates !== undefined) {
    const n = filters.maxRoommates;
    add(
      'roommates',
      n === 0 ? 'No roommates' : `Up to ${n} roommate${n === 1 ? '' : 's'}`,
      omit(filters, 'maxRoommates'),
    );
  }
  if (filters.gender)
    add('gender', GENDER_PREFERENCE_LABELS[filters.gender], omit(filters, 'gender'));
  for (const amenity of filters.amenities ?? []) {
    const rest = (filters.amenities ?? []).filter((a) => a !== amenity);
    add(`amenity-${amenity}`, AMENITY_LABELS[amenity], {
      ...omit(filters, 'amenities'),
      ...(rest.length > 0 ? { amenities: rest } : {}),
    });
  }
  if (filters.maxKm !== undefined)
    add('maxKm', `Within ${filters.maxKm} km`, omit(filters, 'maxKm'));
  if (filters.bounds) add('bounds', 'Map area', omit(filters, 'bounds'));
  return chips;
}
