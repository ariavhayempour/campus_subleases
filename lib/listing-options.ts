export const LISTING_TYPES = ['apartment', 'house'] as const;
export type ListingType = (typeof LISTING_TYPES)[number];
export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  apartment: 'Apartment',
  house: 'House',
};

// The database enum keeps the legacy 'room' value; it reads as an apartment.
export function toListingType(value: string): ListingType {
  return value === 'house' ? 'house' : 'apartment';
}

export const ROOM_TYPES = ['single', 'shared'] as const;
export type RoomType = (typeof ROOM_TYPES)[number];
export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  single: 'Single room',
  shared: 'Shared room',
};

export const ROOM_FEATURES = [
  'closet',
  'walk_in_closet',
  'desk',
  'desk_chair',
  'lamp',
  'window',
  'bed_frame',
  'mattress',
  'dresser',
  'nightstand',
  'mini_fridge',
  'ceiling_fan',
  'door_lock',
] as const;
export type RoomFeature = (typeof ROOM_FEATURES)[number];
export const ROOM_FEATURE_LABELS: Record<RoomFeature, string> = {
  closet: 'Closet',
  walk_in_closet: 'Walk-in closet',
  desk: 'Desk',
  desk_chair: 'Desk chair',
  lamp: 'Lamp',
  window: 'Window',
  bed_frame: 'Bed frame',
  mattress: 'Mattress',
  dresser: 'Dresser',
  nightstand: 'Nightstand',
  mini_fridge: 'Mini fridge',
  ceiling_fan: 'Ceiling fan',
  door_lock: 'Door lock',
};

export function isRoomFeature(value: string): value is RoomFeature {
  return (ROOM_FEATURES as readonly string[]).includes(value);
}

export function roommatesLabel(count: number): string {
  if (count === 0) return 'No roommates';
  return count === 1 ? '1 roommate' : `${count} roommates`;
}

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
  'heating',
  'driveway_parking',
  'garage',
  'yard',
  'porch_deck',
  'basement',
  'elevator',
  'pool',
  'rooftop_lounge',
  'secure_entry',
  'package_room',
  'bike_storage',
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
  heating: 'Heating',
  driveway_parking: 'Driveway or off-street parking',
  garage: 'Garage',
  yard: 'Yard',
  porch_deck: 'Porch or deck',
  basement: 'Basement',
  elevator: 'Elevator',
  pool: 'Pool',
  rooftop_lounge: 'Rooftop or lounge',
  secure_entry: 'Secure entry',
  package_room: 'Package room',
  bike_storage: 'Bike storage',
};

export const HOUSE_AMENITIES: readonly Amenity[] = [
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
];

export const APARTMENT_AMENITIES: readonly Amenity[] = [
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
];

export function amenitiesFor(type: ListingType): readonly Amenity[] {
  return type === 'house' ? HOUSE_AMENITIES : APARTMENT_AMENITIES;
}

// Browse filters stay short: only the original common amenities are filterable.
export const FILTERABLE_AMENITIES = AMENITIES.slice(0, 10) as readonly Amenity[];

export function isAmenity(value: string): value is Amenity {
  return (AMENITIES as readonly string[]).includes(value);
}

export const LISTING_STATUSES = ['active', 'taken', 'removed'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'hidden'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const MAX_ACTIVE_LISTINGS = 1;
export const MAX_PHOTOS = 10;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];

export function isPhotoContentType(value: string): value is PhotoContentType {
  return (PHOTO_CONTENT_TYPES as readonly string[]).includes(value);
}
