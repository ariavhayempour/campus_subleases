import { describe, expect, it } from 'vitest';
import { parseEwkbPoint } from '@/server/db/geography';

describe('parseEwkbPoint', () => {
  it('parses a little-endian EWKB point with SRID', () => {
    expect(parseEwkbPoint('0101000020E610000060E5D022DB5956C0C4B12E6EA3894540')).toEqual({
      lng: -89.404,
      lat: 43.0753,
    });
  });

  it('parses a big-endian EWKB point with SRID', () => {
    expect(parseEwkbPoint('0020000001000010E6C05659DB22D0E560404589A36E2EB1C4')).toEqual({
      lng: -89.404,
      lat: 43.0753,
    });
  });

  it('rejects non-point geometries', () => {
    expect(() => parseEwkbPoint('0102000020E6100000')).toThrow('Expected a Point');
  });
});
