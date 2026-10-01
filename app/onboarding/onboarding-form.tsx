'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { onboardingSchema, type OnboardingInput } from '@/lib/validation/onboarding';
import type { SchoolSummary } from '@/server/services/schools';
import { completeOnboardingAction } from './actions';

export function OnboardingForm({ schools }: { schools: SchoolSummary[] }) {
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
    const result = await completeOnboardingAction(values);
    if (result.ok) return;
    const message = result.error.fieldErrors?.homeSchoolId?.[0];
    if (message) setError('homeSchoolId', { message });
    else setError('root', { message: result.error.message });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-2">
        <Label htmlFor="homeSchoolId">Home school</Label>
        <select
          id="homeSchoolId"
          aria-invalid={Boolean(errors.homeSchoolId)}
          className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          {...register('homeSchoolId')}
        >
          <option value="">Choose your school</option>
          {schools.map((school) => (
            <option key={school.id} value={school.id}>
              {school.name}
            </option>
          ))}
        </select>
        {errors.homeSchoolId && (
          <p className="text-sm text-destructive">{errors.homeSchoolId.message}</p>
        )}
      </div>
      {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        Continue
      </Button>
    </form>
  );
}
