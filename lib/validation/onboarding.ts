import { z } from 'zod';

export const onboardingSchema = z.object({
  homeSchoolId: z.uuid('Choose your school'),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
