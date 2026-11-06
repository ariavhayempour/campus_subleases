'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { schoolThemeStyle } from '@/lib/school-theme';
import { onboardingSchema, type OnboardingInput } from '@/lib/validation/onboarding';
import type { SchoolSummary } from '@/server/services/schools';
import { completeOnboardingAction } from './actions';

export function OnboardingForm({
  schools,
  returnPath,
}: {
  schools: SchoolSummary[];
  returnPath: string | null;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { homeSchoolId: '' },
  });

  async function onSubmit(values: OnboardingInput) {
    const result = await completeOnboardingAction(values, returnPath);
    if (result.ok) return;
    const message = result.error.fieldErrors?.homeSchoolId?.[0];
    if (message) setError('homeSchoolId', { message });
    else setError('root', { message: result.error.message });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-10" noValidate>
      <h2 id="home-school-label" className="varsity text-[1.75rem] font-extrabold text-ink">
        Home school
      </h2>
      <div
        role="radiogroup"
        aria-labelledby="home-school-label"
        aria-invalid={Boolean(errors.homeSchoolId)}
        aria-describedby={errors.homeSchoolId ? 'homeSchoolId-error' : undefined}
        className="mt-4 grid max-w-5xl gap-4 md:grid-cols-3"
      >
        {schools.map((school) => (
          <label
            key={school.id}
            style={schoolThemeStyle(school.theme)}
            className="group relative block cursor-pointer overflow-hidden rounded-md bg-school text-on-school shadow-[0_1px_2px_rgb(0_0_0/0.12)] transition-[transform,box-shadow] duration-300 ease-out-expo hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgb(21_23_28/0.18)] has-[:checked]:shadow-[0_0_0_3px_var(--ink),0_10px_28px_rgb(21_23_28/0.18)] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
          >
            <input
              type="radio"
              value={school.id}
              className="absolute inset-0 z-10 cursor-pointer opacity-0"
              {...register('homeSchoolId')}
            />
            <span className="flex min-h-28 flex-col px-5 pt-5 md:min-h-44">
              <span className="varsity pr-10 text-[clamp(2.25rem,3.4vw,2.75rem)] font-black">
                {school.shortName}
              </span>
              <span className="mt-2 text-sm">{school.name}</span>
              {school.city && <span className="text-sm opacity-90">{school.city}</span>}
              <span
                aria-hidden="true"
                className="absolute top-4 right-4 grid size-7 place-items-center rounded-full border-2 border-on-school/70 group-has-[:checked]:border-transparent group-has-[:checked]:bg-highlight group-has-[:checked]:text-on-highlight"
              >
                <Check className="hidden size-4 group-has-[:checked]:block" strokeWidth={3} />
              </span>
            </span>
            <span aria-hidden="true" className="varsity-stripe mt-auto mb-3 block" />
          </label>
        ))}
      </div>
      {errors.homeSchoolId && (
        <p id="homeSchoolId-error" className="mt-3 text-sm font-medium text-bad">
          {errors.homeSchoolId.message}
        </p>
      )}
      {errors.root && <p className="mt-3 text-sm font-medium text-bad">{errors.root.message}</p>}
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          Continue
        </Button>
        <p className="text-sm text-ink-2">You can&apos;t switch schools after this step.</p>
      </div>
    </form>
  );
}
