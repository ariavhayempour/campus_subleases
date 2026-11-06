import { describe, expect, it } from 'vitest';
import { revealedGroups } from '@/lib/listing-reveal';

const counts = { bedrooms: 2, bathrooms: 1, roommatesCount: 0 };
const none = { counts: false, gender: false, room: false, amenities: false };

describe('revealedGroups', () => {
  it('reveals nothing until a property type is chosen', () => {
    expect(revealedGroups({}, false)).toEqual(none);
  });

  it('reveals the counts once the property type is chosen', () => {
    expect(revealedGroups({ type: 'house' }, false)).toEqual({ ...none, counts: true });
  });

  it('reveals gender only when bedrooms, bathrooms, and roommates are answered', () => {
    expect(revealedGroups({ type: 'house', bedrooms: 2, bathrooms: 1 }, false).gender).toBe(false);
    expect(
      revealedGroups(
        { type: 'house', bedrooms: 2, bathrooms: 1, roommatesCount: Number.NaN },
        false,
      ).gender,
    ).toBe(false);
    expect(revealedGroups({ type: 'house', ...counts }, false).gender).toBe(true);
  });

  it('counts 0 roommates as answered', () => {
    expect(revealedGroups({ type: 'apartment', ...counts, roommatesCount: 0 }, false).gender).toBe(
      true,
    );
  });

  it('reveals room, then amenities, as each earlier group is answered', () => {
    const base = { type: 'apartment', ...counts };
    expect(revealedGroups({ ...base, genderPreference: 'any' }, false)).toEqual({
      counts: true,
      gender: true,
      room: true,
      amenities: false,
    });
    expect(revealedGroups({ ...base, genderPreference: 'any', roomType: 'single' }, false)).toEqual(
      {
        counts: true,
        gender: true,
        room: true,
        amenities: true,
      },
    );
  });

  it('reveals everything when showing all', () => {
    expect(revealedGroups({}, true)).toEqual({
      counts: true,
      gender: true,
      room: true,
      amenities: true,
    });
  });
});
