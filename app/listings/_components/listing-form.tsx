'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { cn } from '@/lib/utils';
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
  // One line beside the submit button about what review saving triggers.
  submitNote: string;
  submitAction: (values: ListingInput) => Promise<ActionResult<void>>;
  // School and type are fixed once a listing exists.
  lockSchoolAndType?: boolean;
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
const selectClass =
  'h-10 w-full rounded-md border border-line-2 bg-background px-3 text-base text-ink transition-[border-color,box-shadow] outline-none hover:border-ink-3 focus-visible:border-school focus-visible:ring-3 focus-visible:ring-school/20 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-2 aria-invalid:border-bad md:text-sm';
const FIXED_FIELD_HINT = 'To change this, delete the listing and post a new one.';
const textareaClass =
  'min-h-40 w-full rounded-md border border-line-2 bg-background px-3 py-2 text-base text-ink transition-[border-color,box-shadow] outline-none hover:border-ink-3 focus-visible:border-school focus-visible:ring-3 focus-visible:ring-school/20 aria-invalid:border-bad md:text-sm';
const hintClass = 'text-sm text-ink-2';
const checkClass = 'size-4 accent-[var(--school)]';
const chipClass =
  'flex cursor-pointer items-center gap-2.5 rounded-md border border-line-2 px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink-3 has-[:checked]:border-school has-[:checked]:bg-school-tint';

const STEPS = [
  { id: 'step-school', label: 'School' },
  { id: 'step-address', label: 'Address' },
  { id: 'step-details', label: 'Details' },
  { id: 'step-photos', label: 'Photos' },
] as const;
type StepId = (typeof STEPS)[number]['id'];

function Step({ index, children }: { index: number; children: ReactNode }) {
  const step = STEPS[index];
  return (
    <section
      id={step.id}
      aria-labelledby={`${step.id}-heading`}
      className="scroll-mt-6 rounded-md border border-line p-5 sm:p-6"
    >
      <h2 id={`${step.id}-heading`} className="flex items-baseline gap-3 text-ink">
        <span aria-hidden="true" className="numeral text-[2rem] text-school">
          {index + 1}
        </span>
        <span className="varsity text-[1.75rem] font-extrabold">{step.label}</span>
      </h2>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

// Highlights the step the reader is in; the rail links are plain anchors without it.
function useActiveStep(): StepId {
  const [active, setActive] = useState<StepId>(STEPS[0].id);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActive(visible.target.id as StepId);
      },
      { rootMargin: '-35% 0px -60% 0px' },
    );
    for (const step of STEPS) {
      const el = document.getElementById(step.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);
  return active;
}

export function ListingForm({
  schools,
  defaultValues,
  initialPhotos,
  submitLabel,
  submitNote,
  submitAction,
  lockSchoolAndType = false,
}: ListingFormProps) {
  const [uploading, setUploading] = useState(false);
  const activeStep = useActiveStep();
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
    <div className="grid gap-8 lg:grid-cols-[200px_1fr] lg:gap-12">
      <nav aria-label="Form steps" className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
        <ol className="grid gap-1">
          {STEPS.map((step, index) => (
            <li key={step.id}>
              <a
                href={`#${step.id}`}
                aria-current={activeStep === step.id ? 'step' : undefined}
                className="grid grid-cols-[2rem_1fr] items-center rounded-md px-2 py-2 text-[15px] font-semibold text-ink-2 no-underline transition-colors hover:bg-surface-2 hover:text-ink aria-[current=step]:bg-school-tint aria-[current=step]:text-ink"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'numeral grid size-7 place-items-center rounded-full text-[15px] ring-1 ring-line-2',
                    activeStep === step.id && 'bg-school text-on-school ring-0',
                  )}
                >
                  {index + 1}
                </span>
                {step.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="min-w-0 space-y-6">
        <Step index={0}>
          <div className="space-y-2">
            <Label htmlFor="schoolId">Which school is this near?</Label>
            {lockSchoolAndType ? (
              <>
                <select
                  id="schoolId"
                  className={selectClass}
                  disabled
                  value={schoolId}
                  aria-describedby="schoolId-hint"
                >
                  {schools.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <input type="hidden" {...register('schoolId')} />
                <p id="schoolId-hint" className={hintClass}>
                  {FIXED_FIELD_HINT}
                </p>
              </>
            ) : (
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
            )}
            <FieldError id="schoolId-error" message={errors.schoolId?.message} />
          </div>
        </Step>

        <Step index={1}>
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
          <p className={hintClass}>
            The street address is public. The unit number is shown only to people who message you.
          </p>
          {farFromCampus && school && (
            <p
              role="status"
              className="flex items-start gap-2.5 rounded-md bg-warn-bg p-3.5 text-sm font-medium text-warn"
            >
              <TriangleAlert aria-hidden="true" className="mt-px size-[18px] shrink-0" />
              <span>
                This is {formatDistanceKm(kmFromCampus)} from {school.name} — is that the right
                school?
              </span>
            </p>
          )}
        </Step>

        <Step index={2}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              {lockSchoolAndType ? (
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
                <select id="type" className={selectClass} {...register('type')}>
                  {LISTING_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {LISTING_TYPE_LABELS[value]}
                    </option>
                  ))}
                </select>
              )}
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
                      field.onChange(
                        event.target.value === '' ? null : event.target.value === 'yes',
                      )
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
              <select
                id="genderPreference"
                className={selectClass}
                {...register('genderPreference')}
              >
                {GENDER_PREFERENCES.map((value) => (
                  <option key={value} value={value}>
                    {GENDER_PREFERENCE_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className={hintClass}>
              A gender preference can only be set for shared spaces (a room, or a place with
              roommates staying).
            </p>
          )}
          <label className={cn(chipClass, 'w-fit')}>
            <input type="checkbox" className={checkClass} {...register('furnished')} />
            Furnished
          </label>
          <fieldset className="space-y-2">
            <legend className="text-[13px] font-semibold text-ink">Amenities</legend>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {AMENITIES.map((amenity) => (
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
          </fieldset>
        </Step>

        <Step index={3}>
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
        </Step>

        {errors.root && (
          <p role="alert" className="text-sm font-medium text-bad">
            {errors.root.message}
          </p>
        )}
        <div className="sticky bottom-0 z-20 -mx-4 flex flex-col gap-2 border-t border-line bg-background px-4 py-3 sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:rounded-t-md sm:border-x sm:px-5">
          <p className="text-sm text-ink-2">{submitNote}</p>
          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-auto"
            disabled={isSubmitting || uploading}
          >
            {isSubmitting ? 'Saving…' : uploading ? 'Waiting for photos…' : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
