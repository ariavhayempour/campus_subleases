import { z } from 'zod';
import { AMENITIES, GENDER_PREFERENCES, LISTING_TYPES } from '@/lib/listing-options';
import { MAX_BEDROOM_OPTION, SORTS, type Sort } from '@/lib/search-options';

export type Bounds = { west: number; south: number; east: number; north: number };
export type RawSearchParams = Record<string, string | string[] | undefined>;

const boundsSchema = z
  .object({
    west: z.number().min(-180).max(180),
    south: z.number().min(-90).max(90),
    east: z.number().min(-180).max(180),
    north: z.number().min(-90).max(90),
  })
  .refine((b) => b.west < b.east && b.south < b.north, 'Invalid map area');

const dollars = z.number().int().min(0).max(10_000);

const fields = {
  q: z.string().trim().min(1).max(200),
  rentMin: dollars,
  rentMax: dollars,
  from: z.iso.date(),
  to: z.iso.date(),
  bedrooms: z.number().int().min(0).max(MAX_BEDROOM_OPTION),
  type: z.enum(LISTING_TYPES),
  furnished: z.literal(true),
  privateBathroom: z.literal(true),
  maxRoommates: z.number().int().min(0).max(10),
  gender: z.enum(GENDER_PREFERENCES).exclude(['any']),
  amenities: z.array(z.enum(AMENITIES)).min(1).max(AMENITIES.length),
  maxKm: z.number().positive().max(100),
  bounds: boundsSchema,
  sort: z.enum(SORTS),
};

export const searchFiltersSchema = z
  .object({
    q: fields.q.optional(),
    rentMin: fields.rentMin.optional(),
    rentMax: fields.rentMax.optional(),
    from: fields.from.optional(),
    to: fields.to.optional(),
    bedrooms: fields.bedrooms.optional(),
    type: fields.type.optional(),
    furnished: fields.furnished.optional(),
    privateBathroom: fields.privateBathroom.optional(),
    maxRoommates: fields.maxRoommates.optional(),
    gender: fields.gender.optional(),
    amenities: fields.amenities.optional(),
    maxKm: fields.maxKm.optional(),
    bounds: fields.bounds.optional(),
    sort: fields.sort.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.rentMin !== undefined &&
      value.rentMax !== undefined &&
      value.rentMax < value.rentMin
    ) {
      ctx.addIssue({ code: 'custom', path: ['rentMax'], message: 'Max rent is below min rent' });
    }
    if (value.from && value.to && value.to < value.from) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'Move-out is before move-in' });
    }
  });

export type SearchFilters = z.output<typeof searchFiltersSchema>;

export const searchRequestSchema = z.object({
  schoolId: z.uuid(),
  filters: searchFiltersSchema,
  offset: z.number().int().min(0).max(10_000).default(0),
});

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const listOf = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

const toNumber = (value: string | undefined): number | undefined =>
  value === undefined || value.trim() === '' ? undefined : Number(value);

function pick<T>(schema: z.ZodType<T>, value: unknown): T | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

function parseBounds(value: string | undefined): Bounds | undefined {
  const parts = value?.split(',').map(Number);
  if (parts?.length !== 4) return undefined;
  const [west, south, east, north] = parts;
  return pick(boundsSchema, { west, south, east, north });
}

// URLs are hand-editable and shared, so bad values are dropped rather than reported.
export function parseSearchParams(raw: RawSearchParams): SearchFilters {
  const amenities = [...new Set(listOf(raw.amenity))].flatMap((value) => {
    const amenity = pick(z.enum(AMENITIES), value);
    return amenity ? [amenity] : [];
  });
  const filters: SearchFilters = {
    q: pick(fields.q, first(raw.q)),
    rentMin: pick(fields.rentMin, toNumber(first(raw.rentMin))),
    rentMax: pick(fields.rentMax, toNumber(first(raw.rentMax))),
    from: pick(fields.from, first(raw.from)),
    to: pick(fields.to, first(raw.to)),
    bedrooms: pick(fields.bedrooms, toNumber(first(raw.beds))),
    type: pick(fields.type, first(raw.type)),
    furnished: first(raw.furnished) === '1' ? true : undefined,
    privateBathroom: first(raw.privateBath) === '1' ? true : undefined,
    maxRoommates: pick(fields.maxRoommates, toNumber(first(raw.maxRoommates))),
    gender: pick(fields.gender, first(raw.gender)),
    amenities: amenities.length > 0 ? amenities : undefined,
    maxKm: pick(fields.maxKm, toNumber(first(raw.maxKm))),
    bounds: parseBounds(first(raw.bbox)),
    sort: pick(fields.sort, first(raw.sort)),
  };
  if (filters.rentMin !== undefined && filters.rentMax !== undefined) {
    if (filters.rentMax < filters.rentMin) filters.rentMax = undefined;
  }
  if (filters.from && filters.to && filters.to < filters.from) filters.to = undefined;
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined),
  ) as SearchFilters;
}

export function effectiveSort(filters: SearchFilters): Sort {
  const fallback: Sort = filters.q ? 'relevance' : 'newest';
  if (!filters.sort || (filters.sort === 'relevance' && !filters.q)) return fallback;
  return filters.sort;
}

export function formatBounds(b: Bounds): string {
  return [b.west, b.south, b.east, b.north].join(',');
}

const round5 = (n: number): number => Math.round(n * 1e5) / 1e5;

export function roundBounds(b: Bounds): Bounds {
  return {
    west: round5(b.west),
    south: round5(b.south),
    east: round5(b.east),
    north: round5(b.north),
  };
}

export function toSearchParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  const set = (name: string, value: string | number | undefined): void => {
    if (value !== undefined) params.set(name, String(value));
  };
  set('q', filters.q);
  set('rentMin', filters.rentMin);
  set('rentMax', filters.rentMax);
  set('from', filters.from);
  set('to', filters.to);
  set('beds', filters.bedrooms);
  set('type', filters.type);
  if (filters.furnished) params.set('furnished', '1');
  if (filters.privateBathroom) params.set('privateBath', '1');
  set('maxRoommates', filters.maxRoommates);
  set('gender', filters.gender);
  for (const amenity of filters.amenities ?? []) params.append('amenity', amenity);
  set('maxKm', filters.maxKm);
  if (filters.bounds) params.set('bbox', formatBounds(filters.bounds));
  const sort = effectiveSort(filters);
  if (sort !== effectiveSort({ q: filters.q })) params.set('sort', sort);
  return params;
}

export function searchParamsToRecord(params: URLSearchParams): RawSearchParams {
  const record: RawSearchParams = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    record[key] = values.length === 1 ? values[0] : values;
  }
  return record;
}

export function hasActiveFilters(filters: SearchFilters): boolean {
  return Object.keys(filters).some((key) => key !== 'sort');
}
