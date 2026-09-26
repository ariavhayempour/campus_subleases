export type LngLat = { lng: number; lat: number };

const SRID_FLAG = 0x20000000;
const POINT_TYPE = 1;

// Postgres returns geography values as hex-encoded EWKB.
export function parseEwkbPoint(hex: string): LngLat {
  const buf = Buffer.from(hex, 'hex');
  const littleEndian = buf.readUInt8(0) === 1;
  const type = littleEndian ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
  if ((type & 0xff) !== POINT_TYPE) throw new Error('Expected a Point');
  const offset = 5 + ((type & SRID_FLAG) !== 0 ? 4 : 0);
  const readDouble = (at: number): number =>
    littleEndian ? buf.readDoubleLE(at) : buf.readDoubleBE(at);
  return { lng: readDouble(offset), lat: readDouble(offset + 8) };
}
