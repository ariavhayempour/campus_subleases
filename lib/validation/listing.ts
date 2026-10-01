import { z } from 'zod';
import {
  AMENITIES,
  GENDER_PREFERENCES,
  LISTING_STATUSES,
  LISTING_TYPES,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  PHOTO_CONTENT_TYPES,
} from '@/lib/listing-options';

export const UPLOAD_PATH_PATTERN = /^listings\/[A-Za-z0-9_]+\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export type LngLat = { lng: number; lat: number };

export const photoRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('existing'), id: z.uuid() }),
  z.object({
    kind: z.literal('upload'),
    path: z.string().regex(UPLOAD_PATH_PATTERN, 'A photo upload is invalid'),
  }),
]);
export type PhotoRef = z.infer<typeof photoRefSchema>;

const ADDRESS_MESSAGE = 'Choose an address from the suggestions';

const locationSchema = z.object(
  {
    lng: z.number({ error: ADDRESS_MESSAGE }).min(-180).max(180),
    lat: z.number({ error: ADDRESS_MESSAGE }).min(-90).max(90),
  },
  { error: ADDRESS_MESSAGE },
);

const wholeNumber = (missing: string, min: number, max: number, minMessage: string) =>
  z
    .number({ error: missing })
    .int('Use a whole number')
    .min(min, minMessage)
    .max(max, `Use at most ${max}`);

export const listingInputSchema = z
  .object({
    schoolId: z.uuid('Choose a school'),
    type: z.enum(LISTING_TYPES, { error: 'Choose a type' }),
    title: z
      .string()
      .trim()
      .min(5, 'Use at least 5 characters')
      .max(100, 'Use at most 100 characters'),
    description: z
      .string()
      .trim()
      .min(20, 'Use at least 20 characters')
      .max(5000, 'Use at most 5,000 characters'),
    rentDollars: z
      .number({ error: 'Enter the monthly rent' })
      .int('Use whole dollars')
      .min(1, 'Rent must be at least $1')
      .max(10_000, 'Rent must be at most $10,000'),
    availableFrom: z.iso.date('Choose a start date'),
    availableTo: z.iso.date('Choose an end date'),
    bedrooms: wholeNumber('Enter the number of bedrooms', 0, 10, 'Use 0 for a studio'),
    bathrooms: z
      .number({ error: 'Enter the number of bathrooms' })
      .min(0.5, 'Use at least 0.5')
      .max(10, 'Use at most 10')
      .multipleOf(0.5, 'Use whole or half numbers'),
    roommatesCount: wholeNumber(
      'Enter the number of roommates',
      0,
      10,
      'Use 0 if nobody else lives there',
    ),
    privateBathroom: z.boolean().nullable(),
    genderPreference: z.enum(GENDER_PREFERENCES),
    address: z.string().trim().min(1, 'Enter the street address').max(200),
    unit: z.string().trim().max(20, 'Use at most 20 characters'),
    city: z.string().trim().min(1, ADDRESS_MESSAGE).max(100),
    state: z.string().trim().min(2, ADDRESS_MESSAGE).max(50),
    zip: z
      .string()
      .trim()
      .regex(/^\d{5}(-\d{4})?$/, 'Enter a 5-digit ZIP code'),
    location: locationSchema.nullable().pipe(locationSchema),
    furnished: z.boolean(),
    amenities: z.array(z.enum(AMENITIES)).max(AMENITIES.length),
    photos: z
      .array(photoRefSchema)
      .min(1, 'Add at least one photo')
      .max(MAX_PHOTOS, `Use at most ${MAX_PHOTOS} photos`),
  })
  .superRefine((value, ctx) => {
    if (value.availableTo <= value.availableFrom) {
      ctx.addIssue({
        code: 'custom',
        path: ['availableTo'],
        message: 'End date must be after the start date',
      });
    }
    if (value.type === 'room' && value.privateBathroom === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['privateBathroom'],
        message: 'Say whether the bathroom is private',
      });
    }
  });

export type ListingInput = z.input<typeof listingInputSchema>;
export type ListingData = z.output<typeof listingInputSchema>;

export const photoUploadRequestSchema = z.object({
  files: z
    .array(
      z.object({
        contentType: z.enum(PHOTO_CONTENT_TYPES, { error: 'Use JPEG, PNG, or WebP photos' }),
        size: z.number().int().min(1).max(MAX_PHOTO_BYTES, 'Each photo must be 10 MB or smaller'),
      }),
    )
    .min(1)
    .max(MAX_PHOTOS, `Add at most ${MAX_PHOTOS} photos at a time`),
});
export type PhotoUploadRequest = z.infer<typeof photoUploadRequestSchema>;

export const listingStatusInputSchema = z.object({
  listingId: z.uuid(),
  status: z.enum(LISTING_STATUSES),
});

export function isUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}
