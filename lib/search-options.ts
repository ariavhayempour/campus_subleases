export const PAGE_SIZE = 24;
export const MAX_MAP_PINS = 500;

export const SORTS = ['newest', 'rent_asc', 'rent_desc', 'distance', 'relevance'] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABELS: Record<Sort, string> = {
  newest: 'Newest',
  rent_asc: 'Rent: low to high',
  rent_desc: 'Rent: high to low',
  distance: 'Closest to campus',
  relevance: 'Best match',
};

// The last bedroom option means "this many or more".
export const BEDROOM_OPTIONS = [0, 1, 2, 3, 4] as const;
export const MAX_BEDROOM_OPTION = 4;

export function bedroomOptionLabel(n: number): string {
  if (n === 0) return 'Studio';
  if (n >= MAX_BEDROOM_OPTION) return `${MAX_BEDROOM_OPTION}+ bedrooms`;
  return `${n} bedroom${n === 1 ? '' : 's'}`;
}

export const MAX_ROOMMATES_OPTIONS = [0, 1, 2, 3, 4] as const;
export const MAX_DISTANCE_OPTIONS_KM = [1, 2, 3, 5, 10, 25] as const;
