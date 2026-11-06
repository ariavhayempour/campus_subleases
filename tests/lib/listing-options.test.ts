import { describe, expect, it } from 'vitest';
import {
  AMENITIES,
  AMENITY_LABELS,
  APARTMENT_AMENITIES,
  FILTERABLE_AMENITIES,
  GENDER_PREFERENCES,
  HOUSE_AMENITIES,
  LISTING_STATUSES,
  LISTING_TYPES,
  REVIEW_STATUSES,
  ROOM_FEATURES,
  ROOM_FEATURE_LABELS,
  amenitiesFor,
  isAmenity,
  isPhotoContentType,
  isRoomFeature,
  roommatesLabel,
  toListingType,
} from '@/lib/listing-options';
import { genderPreference, listingStatus, listingType, reviewStatus } from '@/server/db/schema';

describe('listing options', () => {
  it('match the database enums', () => {
    // The database keeps the legacy 'room' value until a contract migration.
    expect([...LISTING_TYPES, 'room']).toEqual(listingType.enumValues);
    expect([...GENDER_PREFERENCES]).toEqual(genderPreference.enumValues);
    expect([...LISTING_STATUSES]).toEqual(listingStatus.enumValues);
    expect([...REVIEW_STATUSES]).toEqual(reviewStatus.enumValues);
  });

  it('recognizes only known amenities and photo types', () => {
    expect(isAmenity('gym')).toBe(true);
    expect(isAmenity('pool')).toBe(true);
    expect(isAmenity('hot_tub')).toBe(false);
    expect(isRoomFeature('desk')).toBe(true);
    expect(isRoomFeature('gym')).toBe(false);
    expect(isPhotoContentType('image/webp')).toBe(true);
    expect(isPhotoContentType('image/heic')).toBe(false);
  });
});

const sorted = (values: readonly string[]) => [...values].sort();

describe('amenity sets', () => {
  it('give houses and apartments their own lists', () => {
    expect(sorted(HOUSE_AMENITIES)).toEqual(
      sorted([
        'in_unit_laundry',
        'dishwasher',
        'air_conditioning',
        'heating',
        'driveway_parking',
        'garage',
        'yard',
        'porch_deck',
        'basement',
        'pets_allowed',
        'utilities_included',
        'wifi_included',
      ]),
    );
    expect(sorted(APARTMENT_AMENITIES)).toEqual(
      sorted([
        'in_unit_laundry',
        'building_laundry',
        'dishwasher',
        'air_conditioning',
        'balcony',
        'parking_included',
        'elevator',
        'gym',
        'pool',
        'rooftop_lounge',
        'secure_entry',
        'package_room',
        'bike_storage',
        'pets_allowed',
        'utilities_included',
        'wifi_included',
      ]),
    );
    expect(amenitiesFor('apartment')).toContain('gym');
    expect(amenitiesFor('apartment')).not.toContain('garage');
    expect(amenitiesFor('house')).toContain('garage');
    expect(amenitiesFor('house')).not.toContain('gym');
  });

  it('keep the browse filter to the original ten amenities', () => {
    expect(FILTERABLE_AMENITIES).toHaveLength(10);
    expect(FILTERABLE_AMENITIES.every((id) => AMENITIES.includes(id))).toBe(true);
  });

  it('label every amenity and room feature', () => {
    expect(AMENITIES.every((id) => AMENITY_LABELS[id].length > 0)).toBe(true);
    expect(ROOM_FEATURES.every((id) => ROOM_FEATURE_LABELS[id].length > 0)).toBe(true);
  });
});

describe('roommatesLabel', () => {
  it('reads 0 as no roommates', () => {
    expect(roommatesLabel(0)).toBe('No roommates');
    expect(roommatesLabel(1)).toBe('1 roommate');
    expect(roommatesLabel(3)).toBe('3 roommates');
  });
});

describe('toListingType', () => {
  it('maps the legacy room type to apartment', () => {
    expect(toListingType('room')).toBe('apartment');
    expect(toListingType('house')).toBe('house');
    expect(toListingType('apartment')).toBe('apartment');
  });
});
