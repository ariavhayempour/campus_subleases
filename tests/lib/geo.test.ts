import { describe, expect, it } from 'vitest';
import { distanceKm } from '@/lib/geo';

describe('distanceKm', () => {
  it('measures great-circle distance', () => {
    expect(distanceKm({ lng: 0, lat: 0 }, { lng: 0, lat: 1 })).toBeCloseTo(111.19, 1);
    expect(distanceKm({ lng: -89.4, lat: 43.07 }, { lng: -89.4, lat: 43.07 })).toBe(0);
  });
});
