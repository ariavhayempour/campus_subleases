'use client';

import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AMENITY_LABELS,
  amenitiesFor,
  GENDER_PREFERENCE_LABELS,
  GENDER_PREFERENCES,
  LISTING_TYPE_LABELS,
  LISTING_TYPES,
  ROOM_FEATURE_LABELS,
  ROOM_FEATURES,
  ROOM_TYPE_LABELS,
  ROOM_TYPES,
  roommatesLabel,
  type ListingType,
} from '@/lib/listing-options';
import { revealedGroups } from '@/lib/listing-reveal';
import { hasRoommates } from '@/lib/listing-rules';
import { cn } from '@/lib/utils';
import type { ListingData, ListingInput } from '@/lib/validation/listing';
import { FieldError } from './field-error';
import { checkClass, chipClass, FIXED_FIELD_HINT, hintClass, selectClass } from './form-styles';

type GuidedDetailsProps = {
  form: UseFormReturn<ListingInput, unknown, ListingData>;
  // Property type is fixed once a listing exists.
  lockType: boolean;
  // Edit mode shows every group at once.
  showAll: boolean;
};

const ROOMMATE_COUNTS = Array.from({ length: 11 }, (_, i) => i);

export function GuidedDetails({ form, lockType, showAll }: GuidedDetailsProps) {
  const {
    control,
    register,
    getValues,
    setValue,
    formState: { errors },
  } = form;
  const [type, bedrooms, bathrooms, roommatesCount, genderPreference, roomType] = useWatch({
    control,
    name: ['type', 'bedrooms', 'bathrooms', 'roommatesCount', 'genderPreference', 'roomType'],
  });
  const groups = revealedGroups(
    { type, bedrooms, bathrooms, roommatesCount, genderPreference, roomType },
    showAll,
  );
  const propertyType: ListingType = type === 'house' ? 'house' : 'apartment';
  const aria = (name: keyof ListingInput) =>
    errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` } : {};

  const typeField = register('type', {
    // Amenity lists differ by property type, so drop any that no longer apply.
    onChange: (event: { target: { value: string } }) => {
      const next: ListingType = event.target.value === 'house' ? 'house' : 'apartment';
      const allowed: readonly string[] = amenitiesFor(next);
      setValue(
        'amenities',
        getValues('amenities').filter((amenity) => allowed.includes(amenity)),
      );
    },
  });
  const roommatesField = register('roommatesCount', {
    setValueAs: (value: string) => (value === '' || value == null ? Number.NaN : Number(value)),
    // The bathroom answer only exists alongside roommates.
    onChange: (event: { target: { value: string } }) => {
      if (Number(event.target.value) === 0) setValue('privateBathroom', null);
    },
  });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="type">Is it an apartment or a house?</Label>
        {lockType ? (
          <>
            <select
              id="type"
              className={selectClass}
              disabled
              value={type}
              aria-describedby="type-hint"
            >
              {LISTING_TYPES.map((value) => (
                <option key={value} value={value}>
                  {LISTING_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
            <input type="hidden" {...register('type')} />
            <p id="type-hint" className={hintClass}>
              {FIXED_FIELD_HINT}
            </p>
          </>
        ) : (
          <select id="type" className={selectClass} {...aria('type')} {...typeField}>
            <option value="">Choose one</option>
            {LISTING_TYPES.map((value) => (
              <option key={value} value={value}>
                {LISTING_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        )}
        <FieldError id="type-error" message={errors.type?.message} />
      </div>

      {groups.counts && (
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
            <Label htmlFor="roommatesCount">Roommates</Label>
            <select
              id="roommatesCount"
              className={selectClass}
              {...aria('roommatesCount')}
              {...roommatesField}
            >
              <option value="">Choose</option>
              {ROOMMATE_COUNTS.map((count) => (
                <option key={count} value={count}>
                  {roommatesLabel(count)}
                </option>
              ))}
            </select>
            <FieldError id="roommatesCount-error" message={errors.roommatesCount?.message} />
          </div>
        </div>
      )}

      {groups.gender && (
        <div className="space-y-2">
          <Label htmlFor="genderPreference">Gender preference</Label>
          <select
            id="genderPreference"
            className={selectClass}
            {...aria('genderPreference')}
            {...register('genderPreference')}
          >
            <option value="">Choose</option>
            {GENDER_PREFERENCES.map((value) => (
              <option key={value} value={value}>
                {GENDER_PREFERENCE_LABELS[value]}
              </option>
            ))}
          </select>
          <FieldError id="genderPreference-error" message={errors.genderPreference?.message} />
        </div>
      )}

      {groups.room && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="roomType">Room type</Label>
            <select
              id="roomType"
              className={selectClass}
              {...aria('roomType')}
              {...register('roomType')}
            >
              <option value="">Choose</option>
              {ROOM_TYPES.map((value) => (
                <option key={value} value={value}>
                  {ROOM_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
            <FieldError id="roomType-error" message={errors.roomType?.message} />
          </div>
          {Number.isFinite(roommatesCount) && hasRoommates(roommatesCount) && (
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
                      field.onChange(
                        event.target.value === '' ? null : event.target.value === 'yes',
                      )
                    }
                    onBlur={field.onBlur}
                    ref={field.ref}
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
          <fieldset
            className="space-y-2"
            aria-describedby={errors.roomFeatures ? 'roomFeatures-error' : undefined}
          >
            <legend className="text-[13px] font-semibold text-ink">About the room</legend>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {ROOM_FEATURES.map((feature) => (
                <label key={feature} className={chipClass}>
                  <input
                    type="checkbox"
                    value={feature}
                    className={checkClass}
                    {...register('roomFeatures')}
                  />
                  {ROOM_FEATURE_LABELS[feature]}
                </label>
              ))}
              <label className={cn(chipClass)}>
                <input type="checkbox" className={checkClass} {...register('furnished')} />
                Furnished
              </label>
            </div>
            <FieldError id="roomFeatures-error" message={errors.roomFeatures?.message} />
          </fieldset>
        </div>
      )}

      {groups.amenities && (
        <fieldset
          className="space-y-2"
          aria-describedby={errors.amenities ? 'amenities-error' : undefined}
        >
          <legend className="text-[13px] font-semibold text-ink">
            {propertyType === 'house' ? 'House amenities' : 'Apartment and building amenities'}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {amenitiesFor(propertyType).map((amenity) => (
              <label key={amenity} className={chipClass}>
                <input
                  type="checkbox"
                  value={amenity}
                  className={checkClass}
                  {...register('amenities')}
                />
                {AMENITY_LABELS[amenity]}
              </label>
            ))}
          </div>
          <FieldError id="amenities-error" message={errors.amenities?.message} />
        </fieldset>
      )}
    </div>
  );
}
