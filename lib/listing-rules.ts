import {
  MAX_ACTIVE_LISTINGS,
  type GenderPreference,
  type ListingStatus,
  type ReviewStatus,
} from './listing-options';

// Admins post without a cap; everyone else gets MAX_ACTIVE_LISTINGS live listings.
export const listingCap = (isAdmin: boolean): number =>
  isAdmin ? Number.POSITIVE_INFINITY : MAX_ACTIVE_LISTINGS;

export const hasRoommates = (count: number): boolean => count > 0;

export type ReviewedFields = {
  title: string;
  description: string;
  rentCents: number;
  genderPreference: GenderPreference;
  address: string;
  city: string;
  state: string;
  zip: string;
  unit: string | null;
  location: { lng: number; lat: number };
  photoKeys: string[];
};

const SCALAR_FIELDS = [
  'title',
  'description',
  'rentCents',
  'genderPreference',
  'address',
  'city',
  'state',
  'zip',
  'unit',
] as const;

// Only new photos need review; removing or reordering already-reviewed photos does not.
export function reviewedFieldsChanged(before: ReviewedFields, after: ReviewedFields): boolean {
  if (SCALAR_FIELDS.some((field) => before[field] !== after[field])) return true;
  if (before.location.lng !== after.location.lng || before.location.lat !== after.location.lat) {
    return true;
  }
  const reviewed = new Set(before.photoKeys);
  return after.photoKeys.some((key) => !reviewed.has(key));
}

export function nextReviewStatus(current: ReviewStatus, changed: boolean): ReviewStatus {
  if (current === 'rejected') return 'pending';
  if (current === 'hidden') return 'hidden';
  return changed ? 'pending' : current;
}

export type ListingBadge = { label: string; tone: 'neutral' | 'warning' | 'danger' | 'success' };

export function listingBadges(listing: {
  status: ListingStatus;
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
  isExpired: boolean;
}): ListingBadge[] {
  const badges: ListingBadge[] = [];
  if (listing.status === 'taken') badges.push({ label: 'Taken', tone: 'neutral' });
  else if (listing.status === 'removed') badges.push({ label: 'Removed', tone: 'neutral' });
  else if (listing.isExpired) badges.push({ label: 'Expired', tone: 'neutral' });

  if (listing.reviewStatus === 'pending') {
    badges.push({ label: 'Pending review', tone: 'warning' });
  } else if (listing.reviewStatus === 'rejected') {
    badges.push({
      label: `Rejected: ${listing.reviewNote ?? 'no reason given'}`,
      tone: 'danger',
    });
  } else if (listing.reviewStatus === 'hidden') {
    badges.push({ label: 'Hidden by admin', tone: 'danger' });
  } else if (listing.status === 'active' && !listing.isExpired) {
    badges.push({ label: 'Live', tone: 'success' });
  }
  return badges;
}
