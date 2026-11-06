import { describe, expect, it } from 'vitest';
import { activeFilterChips } from '@/lib/active-filters';

describe('activeFilterChips', () => {
  it('is empty without filters and ignores sort', () => {
    expect(activeFilterChips({})).toEqual([]);
    expect(activeFilterChips({ sort: 'rent_asc' })).toEqual([]);
  });

  it('labels each filter and removes only that filter', () => {
    const filters = {
      q: 'balcony',
      rentMin: 500,
      rentMax: 1200,
      from: '2027-05-01',
      type: 'house' as const,
      maxRoommates: 0,
      sort: 'rent_asc' as const,
    };
    const chips = activeFilterChips(filters);
    expect(chips.map((c) => c.label)).toEqual([
      '“balcony”',
      '$500–$1,200',
      'From May 1, 2027',
      'House',
      'No roommates',
    ]);
    const rent = chips.find((c) => c.key === 'rent');
    expect(rent?.without).toEqual({
      q: 'balcony',
      from: '2027-05-01',
      type: 'house',
      maxRoommates: 0,
      sort: 'rent_asc',
    });
  });

  it('gives each amenity its own chip and drops the list when the last one goes', () => {
    const chips = activeFilterChips({ amenities: ['gym', 'balcony'] });
    expect(chips.map((c) => c.label)).toEqual(['Gym', 'Balcony']);
    expect(chips[0].without).toEqual({ amenities: ['balcony'] });
    expect(activeFilterChips({ amenities: ['gym'] })[0].without).toEqual({});
  });

  it('labels open-ended rent ranges', () => {
    expect(activeFilterChips({ rentMax: 900 })[0].label).toBe('Up to $900');
    expect(activeFilterChips({ rentMin: 700 })[0].label).toBe('$700+');
  });
});
