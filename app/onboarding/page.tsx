import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireSignedIn } from '@/app/_lib/guards';
import { APP_NAME } from '@/lib/app-config';
import { safeReturnPath } from '@/lib/return-path';
import { listActiveSchools } from '@/server/services/schools';
import { getOnboardingState } from '@/server/services/users';
import { OnboardingForm } from './onboarding-form';

export const metadata: Metadata = { title: 'Welcome' };

export default async function OnboardingPage({ searchParams }: PageProps<'/onboarding'>) {
  const actor = await requireSignedIn();
  const returnPath = safeReturnPath((await searchParams).next);
  const state = await getOnboardingState(actor);
  if (!state.needsOnboarding && state.homeSchoolSlug) {
    redirect(returnPath ?? `/${state.homeSchoolSlug}`);
  }
  const schools = await listActiveSchools();
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <h1 className="varsity text-[clamp(2.75rem,6vw,4.5rem)] font-black text-ink">
        Welcome to {APP_NAME}
      </h1>
      <p className="mt-3 max-w-[60ch] text-[16px] text-ink-2">
        Pick your school to see subleases near campus. This is your home school: you&apos;ll see its
        listings and colors, and it can&apos;t be changed later.
      </p>
      <OnboardingForm schools={schools} returnPath={returnPath} />
    </main>
  );
}
