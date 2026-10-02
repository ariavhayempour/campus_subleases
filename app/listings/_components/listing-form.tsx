'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { Controller, useForm, useWatch, type DefaultValues, type Path } from 'react-hook-form';
import type { ActionResult } from '@/app/_lib/action-result';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDistanceKm } from '@/lib/format';
import { distanceKm } from '@/lib/geo';
import {
  AMENITIES,
  AMENITY_LABELS,
  GENDER_PREFERENCE_LABELS,
  GENDER_PREFERENCES,
  LISTING_TYPE_LABELS,
  LISTING_TYPES,
} from '@/lib/listing-options';
import { isSharedSpace } from '@/lib/listing-rules';
import { listingInputSchema, type ListingData, type ListingInput } from '@/lib/validation/listing';
import type { SchoolOption } from '@/server/services/listing-reads';
import { AddressField, type PickedAddress } from './address-field';
import { FieldError } from './field-error';
import { PhotoUploader, type InitialPhoto } from './photo-uploader';

type ListingFormProps = {
  schools: SchoolOption[];
  defaultValues: DefaultValues<ListingInput>;
  initialPhotos: InitialPhoto[];
  submitLabel: string;
  submitAction: (values: ListingInput) => Promise<ActionResult<void>>;
};

// Fields with a visible error slot; errors on any other field go to the form-level message.
const RENDERED_FIELDS = new Set([
  'schoolId',
  'address',
  'location',
  'city',
  'state',
  'zip',
  'unit',
  'rentDollars',
  'title',
  'description',
  'availableFrom',
  'availableTo',
  'bedrooms',
  'bathrooms',
  'roommatesCount',
  'privateBathroom',
  'photos',
]);
const selectClass = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm';
const textareaClass =
  'min-h-40 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm';

export function ListingForm({
  schools,
  defaultValues,
  initialPhotos,
  submitLabel,
  submitAction,
}: ListingFormProps) {
  const [uploading, setUploading] = useState(false);
  // Address text last set by a suggestion; typing anything else invalidates the stored location.
  const pickedAddress = useRef(defaultValues.address ?? '');
  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ListingInput, unknown, ListingData>({
    resolver: zodResolver(listingInputSchema),
    defaultValues,
  });
  const [type, roommatesCount, schoolId, location] = useWatch({
    control,
    name: ['type', 'roommatesCount', 'schoolId', 'location'],
  });

  // Links a field's error text to its input for assistive tech.
  const aria = (name: keyof ListingInput) =>
    errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` } : {};

  const shared = isSharedSpace(type, Number.isFinite(roommatesCount) ? roommatesCount : 0);
  const school = schools.find((candidate) => candidate.id === schoolId);
  const kmFromCampus = school && location ? distanceKm(location, school.campusLocation) : 0;
  const farFromCampus = school !== undefined && kmFromCampus > school.warnRadiusKm;

  async function onSubmit(values: ListingData) {
    const result = await submitAction(values);
    if (result.ok) return;
    let placed = false;
    const unplaced: string[] = [];
    for (const [field, messages] of Object.entries(result.error.fieldErrors ?? {})) {
      if (!messages[0]) continue;
      if (RENDERED_FIELDS.has(field)) {
        setError(field as Path<ListingInput>, { message: messages[0] });
        placed = true;
      } else {
        unplaced.push(messages[0]);
      }
    }
    if (unplaced.length > 0 || !placed) {
      setError('root', { message: unplaced[0] ?? result.error.message });
    }
  }

  function onAddressTyped(value: string) {
    if (value !== pickedAddress.current) setValue('location', null);
  }

  function onAddressPicked(picked: PickedAddress) {
    const options = { shouldValidate: true, shouldDirty: true };
    pickedAddress.current = picked.address;
    setValue('address', picked.address, options);
    setValue('city', picked.city, options);
    setValue('state', picked.state, options);
    setValue('zip', picked.zip, options);
    setValue('location', picked.location, options);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-lg font-medium">School</h2>
        <div className="space-y-2">
          <Label htmlFor="schoolId">Which school is this near?</Label>
          <select
            id="schoolId"
            className={selectClass}
            {...aria('schoolId')}
            {...register('schoolId')}
          >
            <option value="">Choose a school</option>
            {schools.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <FieldError id="schoolId-error" message={errors.schoolId?.message} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Address</h2>
        <AddressField
          inputProps={register('address')}
          invalid={Boolean(errors.address || errors.location || errors.city || errors.state)}
          errorId="address-error"
          onTyped={onAddressTyped}
          onPick={onAddressPicked}
        />
        <FieldError
          id="address-error"
          message={
            errors.address?.message ??
            errors.location?.message ??
            errors.city?.message ??
            errors.state?.message
          }
        />
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="unit">Unit (optional)</Label>
            <Input id="unit" autoComplete="off" {...aria('unit')} {...register('unit')} />
            <FieldError id="unit-error" message={errors.unit?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" readOnly tabIndex={-1} {...register('city')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input id="state" readOnly tabIndex={-1} {...register('state')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zip">ZIP</Label>
            <Input id="zip" readOnly tabIndex={-1} {...aria('zip')} {...register('zip')} />
            <FieldError id="zip-error" message={errors.zip?.message} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          The street address is public. The unit number is shown only to people who message you.
        </p>
        {farFromCampus && school && (
          <p
            role="status"
            className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
          >
            This is {formatDistanceKm(kmFromCampus)} from {school.name} — is that the right school?
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <select id="type" className={selectClass} {...register('type')}>
              {LISTING_TYPES.map((value) => (
                <option key={value} value={value}>
                  {LISTING_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rentDollars">Monthly rent ($)</Label>
            <Input
              id="rentDollars"
              type="number"
              inputMode="numeric"
              min={1}
              {...aria('rentDollars')}
              {...register('rentDollars', { valueAsNumber: true })}
            />
            <FieldError id="rentDollars-error" message={errors.rentDollars?.message} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" {...aria('title')} {...register('title')} />
          <FieldError id="title-error" message={errors.title?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            className={textareaClass}
            {...aria('description')}
            {...register('description')}
          />
          <FieldError id="description-error" message={errors.description?.message} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="availableFrom">Available from</Label>
            <Input
              id="availableFrom"
              type="date"
              {...aria('availableFrom')}
              {...register('availableFrom')}
            />
            <FieldError id="availableFrom-error" message={errors.availableFrom?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="availableTo">Available until</Label>
            <Input
              id="availableTo"
              type="date"
              {...aria('availableTo')}
              {...register('availableTo')}
            />
            <FieldError id="availableTo-error" message={errors.availableTo?.message} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="bedrooms">Bedrooms (0 = studio)</Label>
            <Input
              id="bedrooms"
              type="number"
              min={0}
              {...aria('bedrooms')}
              {...register('bedrooms', { valueAsNumber: true })}
            />
            <FieldError id="bedrooms-error" message={errors.bedrooms?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bathrooms">Bathrooms</Label>
            <Input
              id="bathrooms"
              type="number"
              min={0.5}
              step={0.5}
              {...aria('bathrooms')}
              {...register('bathrooms', { valueAsNumber: true })}
            />
            <FieldError id="bathrooms-error" message={errors.bathrooms?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="roommatesCount">Roommates staying</Label>
            <Input
              id="roommatesCount"
              type="number"
              min={0}
              {...aria('roommatesCount')}
              {...register('roommatesCount', { valueAsNumber: true })}
            />
            <FieldError id="roommatesCount-error" message={errors.roommatesCount?.message} />
          </div>
        </div>
        {type === 'room' && (
          <div className="space-y-2">
            <Label htmlFor="privateBathroom">Private bathroom?</Label>
            <Controller
              control={control}
              name="privateBathroom"
              render={({ field }) => (
                <select
                  id="privateBathroom"
                  className={selectClass}
                  value={
                    field.value === null || field.value === undefined
                      ? ''
                      : field.value
                        ? 'yes'
                        : 'no'
                  }
                  onChange={(event) =>
                    field.onChange(event.target.value === '' ? null : event.target.value === 'yes')
                  }
                  onBlur={field.onBlur}
                  {...aria('privateBathroom')}
                >
                  <option value="">Choose</option>
                  <option value="yes">Yes, private</option>
                  <option value="no">No, shared</option>
                </select>
              )}
            />
            <FieldError id="privateBathroom-error" message={errors.privateBathroom?.message} />
          </div>
        )}
        {shared ? (
          <div className="space-y-2">
            <Label htmlFor="genderPreference">Roommate gender preference</Label>
            <select id="genderPreference" className={selectClass} {...register('genderPreference')}>
              {GENDER_PREFERENCES.map((value) => (
                <option key={value} value={value}>
                  {GENDER_PREFERENCE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            A gender preference can only be set for shared spaces (a room, or a place with roommates
            staying).
          </p>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('furnished')} />
          Furnished
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Amenities</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {AMENITIES.map((amenity) => (
              <label key={amenity} className="flex items-center gap-2 text-sm">
                <input type="checkbox" value={amenity} {...register('amenities')} />
                {AMENITY_LABELS[amenity]}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Photos</h2>
        <Controller
          control={control}
          name="photos"
          render={({ field }) => (
            <PhotoUploader
              initialPhotos={initialPhotos}
              onChange={field.onChange}
              onBusyChange={setUploading}
              invalid={Boolean(errors.photos)}
            />
          )}
        />
        <FieldError id="photos-error" message={errors.photos?.message} />
      </section>

      {errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}
      <Button type="submit" size="lg" disabled={isSubmitting || uploading}>
        {isSubmitting ? 'Saving…' : uploading ? 'Waiting for photos…' : submitLabel}
      </Button>
    </form>
  );
}
