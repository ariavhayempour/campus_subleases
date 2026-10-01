import { describe, expect, it } from 'vitest';
import {
  isSharedSpace,
  listingBadges,
  nextReviewStatus,
  reviewedFieldsChanged,
  type ReviewedFields,
} from '@/lib/listing-rules';

const base: ReviewedFields = {
  title: 'Sunny studio',
  description: 'Bright studio with big windows, five minutes from campus.',
  rentCents: 95_000,
  genderPreference: 'any',
  address: '123 State St',
  city: 'Madison',
  state: 'WI',
  zip: '53703',
  unit: null,
  location: { lng: -89.39, lat: 43.07 },
  photoKeys: ['a', 'b'],
};

describe('isSharedSpace', () => {
  it('is true for rooms or places with roommates', () => {
    expect(isSharedSpace('room', 0)).toBe(true);
    expect(isSharedSpace('apartment', 1)).toBe(true);
    expect(isSharedSpace('house', 0)).toBe(false);
  });
});

describe('reviewedFieldsChanged', () => {
  it('detects each reviewed field', () => {
    const changes: Partial<ReviewedFields>[] = [
      { title: 'Other' },
      { description: 'Another description that is long enough.' },
      { rentCents: 90_000 },
      { genderPreference: 'women' },
      { address: '1 Main St' },
      { city: 'Ann Arbor' },
      { state: 'MI' },
      { zip: '48104' },
      { unit: '4B' },
      { location: { lng: -89.38, lat: 43.07 } },
      { photoKeys: ['a', 'b', 'c'] },
      { photoKeys: ['a', 'c'] },
    ];
    for (const change of changes) {
      expect(reviewedFieldsChanged(base, { ...base, ...change })).toBe(true);
    }
  });

  it('ignores removing or reordering photos, and identical values', () => {
    expect(reviewedFieldsChanged(base, { ...base, photoKeys: ['b', 'a'] })).toBe(false);
    expect(reviewedFieldsChanged(base, { ...base, photoKeys: ['b'] })).toBe(false);
    expect(reviewedFieldsChanged(base, { ...base })).toBe(false);
  });
});

describe('nextReviewStatus', () => {
  it('applies the re-review rules', () => {
    expect(nextReviewStatus('approved', true)).toBe('pending');
    expect(nextReviewStatus('approved', false)).toBe('approved');
    expect(nextReviewStatus('pending', false)).toBe('pending');
    expect(nextReviewStatus('rejected', false)).toBe('pending');
    expect(nextReviewStatus('hidden', true)).toBe('hidden');
  });
});

describe('listingBadges', () => {
  const live = {
    status: 'active',
    reviewStatus: 'approved',
    reviewNote: null,
    isExpired: false,
  } as const;

  it('labels each state', () => {
    expect(listingBadges(live)).toEqual([{ label: 'Live', tone: 'success' }]);
    expect(listingBadges({ ...live, reviewStatus: 'pending' })).toEqual([
      { label: 'Pending review', tone: 'warning' },
    ]);
    expect(
      listingBadges({ ...live, reviewStatus: 'rejected', reviewNote: 'Blurry photos' }),
    ).toEqual([{ label: 'Rejected: Blurry photos', tone: 'danger' }]);
    expect(listingBadges({ ...live, reviewStatus: 'hidden' })).toEqual([
      { label: 'Hidden by admin', tone: 'danger' },
    ]);
    expect(listingBadges({ ...live, status: 'taken' })).toEqual([
      { label: 'Taken', tone: 'neutral' },
    ]);
    expect(listingBadges({ ...live, isExpired: true })).toEqual([
      { label: 'Expired', tone: 'neutral' },
    ]);
  });
});
