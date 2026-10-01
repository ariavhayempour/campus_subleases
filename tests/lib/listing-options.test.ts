import { describe, expect, it } from 'vitest';
import {
  GENDER_PREFERENCES,
  LISTING_STATUSES,
  LISTING_TYPES,
  REVIEW_STATUSES,
  isAmenity,
  isPhotoContentType,
} from '@/lib/listing-options';
import { genderPreference, listingStatus, listingType, reviewStatus } from '@/server/db/schema';

describe('listing options', () => {
  it('match the database enums', () => {
    expect([...LISTING_TYPES]).toEqual(listingType.enumValues);
    expect([...GENDER_PREFERENCES]).toEqual(genderPreference.enumValues);
    expect([...LISTING_STATUSES]).toEqual(listingStatus.enumValues);
    expect([...REVIEW_STATUSES]).toEqual(reviewStatus.enumValues);
  });

  it('recognizes only known amenities and photo types', () => {
    expect(isAmenity('gym')).toBe(true);
    expect(isAmenity('pool')).toBe(false);
    expect(isPhotoContentType('image/webp')).toBe(true);
    expect(isPhotoContentType('image/heic')).toBe(false);
  });
});
