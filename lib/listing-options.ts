export const LISTING_TYPES = ['apartment', 'house', 'room'] as const;
export type ListingType = (typeof LISTING_TYPES)[number];
export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  apartment: 'Apartment',
  house: 'House',
  room: 'Room in a shared place',
};

export const GENDER_PREFERENCES = ['any', 'women', 'men', 'nonbinary_friendly'] as const;
export type GenderPreference = (typeof GENDER_PREFERENCES)[number];
export const GENDER_PREFERENCE_LABELS: Record<GenderPreference, string> = {
  any: 'Anyone',
  women: 'Women',
  men: 'Men',
  nonbinary_friendly: 'Nonbinary-friendly',
};

export const AMENITIES = [
  'in_unit_laundry',
  'building_laundry',
  'parking_included',
  'air_conditioning',
  'dishwasher',
  'pets_allowed',
  'gym',
  'balcony',
  'utilities_included',
  'wifi_included',
] as const;
export type Amenity = (typeof AMENITIES)[number];
export const AMENITY_LABELS: Record<Amenity, string> = {
  in_unit_laundry: 'In-unit laundry',
  building_laundry: 'Laundry in building',
  parking_included: 'Parking included',
  air_conditioning: 'Air conditioning',
  dishwasher: 'Dishwasher',
  pets_allowed: 'Pets allowed',
  gym: 'Gym',
  balcony: 'Balcony',
  utilities_included: 'Utilities included',
  wifi_included: 'Wi-Fi included',
};

export function isAmenity(value: string): value is Amenity {
  return (AMENITIES as readonly string[]).includes(value);
}

export const LISTING_STATUSES = ['active', 'taken', 'removed'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'hidden'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const MAX_ACTIVE_LISTINGS = 2;
export const MAX_PHOTOS = 10;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];

export function isPhotoContentType(value: string): value is PhotoContentType {
  return (PHOTO_CONTENT_TYPES as readonly string[]).includes(value);
}
