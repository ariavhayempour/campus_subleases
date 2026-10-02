import { randomUUID } from 'node:crypto';
import type { ListingInput, PhotoRef } from '@/lib/validation/listing';
import { jpegWithGps, putUpload } from './photos';

export function listingInput(
  schoolId: string,
  photos: PhotoRef[],
  overrides: Partial<ListingInput> = {},
): ListingInput {
  return {
    schoolId,
    type: 'apartment',
    title: 'Sunny studio near campus',
    description: 'Bright studio with big windows, five minutes from campus.',
    rentDollars: 950,
    availableFrom: '2027-01-01',
    availableTo: '2027-05-31',
    bedrooms: 0,
    bathrooms: 1,
    roommatesCount: 0,
    privateBathroom: null,
    genderPreference: 'any',
    address: '123 State St',
    unit: '',
    city: 'Madison',
    state: 'WI',
    zip: '53703',
    location: { lng: -89.39, lat: 43.07 },
    furnished: true,
    amenities: [],
    photos,
    ...overrides,
  };
}

export async function uploadedPhoto(userId: string): Promise<PhotoRef> {
  return { kind: 'upload', path: await putUpload(userId, await jpegWithGps(320, 240)) };
}

// A well-formed path that was never uploaded, for tests that fail before processing.
export const fakeUpload = (userId: string): PhotoRef => ({
  kind: 'upload',
  path: `listings/${userId}/${randomUUID()}.jpg`,
});
