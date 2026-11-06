import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  isUuid,
  listingInputSchema,
  photoUploadRequestSchema,
  type ListingInput,
} from '@/lib/validation/listing';

const validInput = (overrides: Partial<ListingInput> = {}): ListingInput => ({
  schoolId: '00000000-0000-4000-8000-000000000000',
  type: 'apartment',
  title: '  Sunny studio near campus  ',
  description: 'Bright studio with big windows, five minutes from campus.',
  rentDollars: 950,
  availableFrom: '2027-01-01',
  availableTo: '2027-05-31',
  bedrooms: 0,
  bathrooms: 1,
  roommatesCount: 0,
  privateBathroom: null,
  genderPreference: 'any',
  roomType: 'single',
  roomFeatures: [],
  address: '123 State St',
  unit: '',
  city: 'Madison',
  state: 'WI',
  zip: '53703',
  location: { lng: -89.39, lat: 43.07 },
  furnished: true,
  amenities: ['gym'],
  photos: [{ kind: 'upload', path: 'listings/user_abc/0f8fad5b-d9cb-469f-a165-70867728950e.jpg' }],
  ...overrides,
});

const fieldErrors = (input: unknown): Record<string, string[] | undefined> => {
  const result = listingInputSchema.safeParse(input);
  return result.success ? {} : z.flattenError(result.error).fieldErrors;
};

describe('listingInputSchema', () => {
  it('accepts a valid listing and trims text', () => {
    const parsed = listingInputSchema.parse(validInput());
    expect(parsed.title).toBe('Sunny studio near campus');
    expect(parsed.location).toEqual({ lng: -89.39, lat: 43.07 });
  });

  it('requires the end date after the start date', () => {
    expect(fieldErrors(validInput({ availableTo: '2027-01-01' })).availableTo).toEqual([
      'End date must be after the start date',
    ]);
  });

  it('requires a private-bathroom answer only when there are roommates', () => {
    expect(fieldErrors(validInput({ roommatesCount: 2 })).privateBathroom).toEqual([
      'Say whether the bathroom is private',
    ]);
    expect(fieldErrors(validInput({ roommatesCount: 2, privateBathroom: false }))).toEqual({});
    expect(fieldErrors(validInput({ roommatesCount: 0, privateBathroom: null }))).toEqual({});
    expect(fieldErrors(validInput({ roommatesCount: 0, privateBathroom: true }))).toEqual({});
  });

  it('reports cross-field problems together with other field errors', () => {
    const errors = fieldErrors(
      validInput({
        rentDollars: Number.NaN,
        type: 'house',
        amenities: ['gym'],
        roommatesCount: 2,
        privateBathroom: null,
        availableTo: '2027-01-01',
      }),
    );
    expect(errors.rentDollars).toBeDefined();
    expect(errors.amenities).toBeDefined();
    expect(errors.privateBathroom).toBeDefined();
    expect(errors.availableTo).toBeDefined();
  });

  it('does not crash on cross-field checks when the type or amenities are missing', () => {
    expect(() =>
      fieldErrors({
        ...validInput(),
        type: undefined,
        amenities: undefined,
        roommatesCount: undefined,
      }),
    ).not.toThrow();
  });

  it('no longer accepts the room type', () => {
    expect(fieldErrors({ ...validInput(), type: 'room' }).type).toBeDefined();
  });

  it('requires a room type, a gender preference, and known room features', () => {
    expect(fieldErrors({ ...validInput(), roomType: undefined }).roomType).toEqual([
      'Choose single or shared',
    ]);
    expect(
      fieldErrors({ ...validInput(), genderPreference: undefined }).genderPreference,
    ).toBeDefined();
    expect(fieldErrors({ ...validInput(), roomFeatures: ['desk', 'lamp'] })).toEqual({});
    expect(fieldErrors({ ...validInput(), roomFeatures: ['hot_tub'] }).roomFeatures).toBeDefined();
  });

  it('only accepts amenities from the list for the property type', () => {
    expect(fieldErrors(validInput({ type: 'house', amenities: ['gym'] })).amenities).toEqual([
      "Some amenities don't apply to this property type",
    ]);
    expect(fieldErrors(validInput({ type: 'house', amenities: ['garage', 'yard'] }))).toEqual({});
    expect(
      fieldErrors(validInput({ type: 'apartment', amenities: ['garage'] })).amenities,
    ).toBeDefined();
    expect(fieldErrors(validInput({ type: 'apartment', amenities: ['pool', 'gym'] }))).toEqual({});
  });

  it('requires an address chosen from the suggestions', () => {
    expect(fieldErrors(validInput({ location: null })).location).toEqual([
      'Choose an address from the suggestions',
    ]);
  });

  it('enforces rent, bathroom, and roommate bounds', () => {
    expect(fieldErrors(validInput({ rentDollars: 0 })).rentDollars).toBeDefined();
    expect(fieldErrors(validInput({ rentDollars: 10_001 })).rentDollars).toBeDefined();
    expect(fieldErrors(validInput({ bathrooms: 1.5 }))).toEqual({});
    expect(fieldErrors(validInput({ bathrooms: 1.25 })).bathrooms).toBeDefined();
    expect(fieldErrors(validInput({ roommatesCount: 11 })).roommatesCount).toBeDefined();
  });

  it('requires 1 to 10 photos with valid upload paths', () => {
    expect(fieldErrors(validInput({ photos: [] })).photos).toEqual(['Add at least one photo']);
    const eleven = Array.from({ length: 11 }, () => validInput().photos[0]);
    expect(fieldErrors(validInput({ photos: eleven })).photos).toEqual(['Use at most 10 photos']);
    expect(
      fieldErrors(validInput({ photos: [{ kind: 'upload', path: '../etc/passwd' }] })).photos,
    ).toBeDefined();
  });

  it('validates the ZIP code and amenities', () => {
    expect(fieldErrors(validInput({ zip: '5370' })).zip).toEqual(['Enter a 5-digit ZIP code']);
    expect(fieldErrors(validInput({ zip: '53703-1234' }))).toEqual({});
    expect(fieldErrors({ ...validInput(), amenities: ['hot_tub'] }).amenities).toBeDefined();
  });
});

describe('photoUploadRequestSchema', () => {
  it('allows JPEG, PNG, and WebP up to 10 MB', () => {
    const ok = photoUploadRequestSchema.safeParse({
      files: [{ contentType: 'image/png', size: 10 * 1024 * 1024 }],
    });
    expect(ok.success).toBe(true);
    const heic = photoUploadRequestSchema.safeParse({
      files: [{ contentType: 'image/heic', size: 1000 }],
    });
    expect(heic.success).toBe(false);
    const big = photoUploadRequestSchema.safeParse({
      files: [{ contentType: 'image/jpeg', size: 10 * 1024 * 1024 + 1 }],
    });
    expect(big.success).toBe(false);
  });
});

describe('isUuid', () => {
  it('distinguishes UUIDs from other strings', () => {
    expect(isUuid('0f8fad5b-d9cb-469f-a165-70867728950e')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });
});
