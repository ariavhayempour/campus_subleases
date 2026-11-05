import { describe, expect, it } from 'vitest';
import {
  clampBounds,
  effectiveSort,
  hasActiveFilters,
  parseSearchParams,
  roundBounds,
  searchFiltersSchema,
  searchParamsToRecord,
  toSearchParams,
  type SearchFilters,
} from '@/lib/validation/search';

const full: SearchFilters = {
  q: 'balcony',
  rentMin: 500,
  rentMax: 1500,
  from: '2027-01-01',
  to: '2027-05-31',
  bedrooms: 2,
  type: 'apartment',
  furnished: true,
  privateBathroom: true,
  maxRoommates: 1,
  gender: 'women',
  amenities: ['gym', 'dishwasher'],
  maxKm: 5,
  bounds: { west: -89.41, south: 43.07, east: -89.39, north: 43.08 },
  sort: 'rent_asc',
};

const roundTrip = (filters: SearchFilters): SearchFilters =>
  parseSearchParams(searchParamsToRecord(toSearchParams(filters)));

describe('parseSearchParams', () => {
  it('reads every filter from URL parameters', () => {
    expect(
      parseSearchParams({
        q: ' balcony ',
        rentMin: '500',
        rentMax: '1500',
        from: '2027-01-01',
        to: '2027-05-31',
        beds: '2',
        type: 'apartment',
        furnished: '1',
        privateBath: '1',
        maxRoommates: '1',
        gender: 'women',
        amenity: ['gym', 'dishwasher'],
        maxKm: '5',
        bbox: '-89.41,43.07,-89.39,43.08',
        sort: 'rent_asc',
      }),
    ).toEqual(full);
  });

  it('ignores blank and invalid values one by one', () => {
    expect(
      parseSearchParams({
        q: '   ',
        rentMin: 'abc',
        rentMax: '900',
        from: '2027-02-30',
        beds: '9',
        type: 'castle',
        furnished: 'yes',
        gender: 'any',
        amenity: ['gym', 'pool', 'gym'],
        maxKm: '-3',
        bbox: '1,2,3',
        sort: 'random',
      }),
    ).toEqual({ rentMax: 900, amenities: ['gym'] });
  });

  it('takes the first value when a single-valued parameter repeats', () => {
    expect(parseSearchParams({ type: ['house', 'room'] })).toEqual({ type: 'house' });
  });

  it('drops a max rent below the min and a move-out before the move-in', () => {
    expect(
      parseSearchParams({ rentMin: '1000', rentMax: '500', from: '2027-05-01', to: '2027-04-01' }),
    ).toEqual({ rentMin: 1000, from: '2027-05-01' });
  });

  it('rejects inverted bounds', () => {
    expect(parseSearchParams({ bbox: '-89.39,43.07,-89.41,43.08' })).toEqual({});
  });
});

describe('toSearchParams', () => {
  it('round-trips every filter', () => {
    expect(roundTrip(full)).toEqual(full);
  });

  it('writes nothing for empty filters and omits the default sort', () => {
    expect(toSearchParams({}).toString()).toBe('');
    expect(toSearchParams({ sort: 'newest' }).toString()).toBe('');
    expect(toSearchParams({ q: 'loft', sort: 'relevance' }).toString()).toBe('q=loft');
    expect(toSearchParams({ q: 'loft', sort: 'newest' }).toString()).toBe('q=loft&sort=newest');
  });
});

describe('effectiveSort', () => {
  it('defaults to newest, or relevance when a keyword is set', () => {
    expect(effectiveSort({})).toBe('newest');
    expect(effectiveSort({ q: 'loft' })).toBe('relevance');
    expect(effectiveSort({ sort: 'relevance' })).toBe('newest');
    expect(effectiveSort({ q: 'loft', sort: 'rent_desc' })).toBe('rent_desc');
  });
});

describe('hasActiveFilters', () => {
  it('ignores the sort only', () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ sort: 'rent_asc' })).toBe(false);
    expect(hasActiveFilters({ furnished: true })).toBe(true);
  });
});

describe('roundBounds', () => {
  it('rounds to 5 decimal places', () => {
    expect(roundBounds({ west: -89.123456, south: 43.000004, east: -89.1, north: 43.2 })).toEqual({
      west: -89.12346,
      south: 43,
      east: -89.1,
      north: 43.2,
    });
  });
});

describe('clampBounds', () => {
  it('pulls world-copy longitudes and out-of-range latitudes back into range', () => {
    expect(clampBounds({ west: -412.5, south: -95, east: 388.25, north: 91 })).toEqual({
      west: -180,
      south: -90,
      east: 180,
      north: 90,
    });
  });

  it('leaves in-range bounds unchanged', () => {
    const bounds = { west: -89.41, south: 43.07, east: -89.39, north: 43.08 };
    expect(clampBounds(bounds)).toEqual(bounds);
  });

  it('makes a zoomed-out map area survive the URL round trip', () => {
    const bounds = roundBounds(
      clampBounds({ west: -300.123456, south: -85, east: 250, north: 85 }),
    );
    expect(roundTrip({ bounds })).toEqual({ bounds });
  });
});

describe('searchFiltersSchema', () => {
  it('rejects crossed ranges on the field that shows the message', () => {
    const result = searchFiltersSchema.safeParse({ rentMin: 900, rentMax: 500 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['rentMax']);
    const dates = searchFiltersSchema.safeParse({ from: '2027-05-01', to: '2027-04-01' });
    expect(dates.error?.issues[0].path).toEqual(['to']);
  });
});
