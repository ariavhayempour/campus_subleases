import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireSignedIn } from '@/app/_lib/guards';
import { APP_NAME } from '@/lib/app-config';
import { listActiveSchools } from '@/server/services/schools';
import { getOnboardingState } from '@/server/services/users';
import { OnboardingForm } from './onboarding-form';

export const metadata: Metadata = { title: 'Welcome' };

export default async function OnboardingPage() {
  const actor = await requireSignedIn();
  const state = await getOnboardingState(actor);
  if (!state.needsOnboarding && state.homeSchoolSlug) redirect(`/${state.homeSchoolSlug}`);
  const schools = await listActiveSchools();
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Welcome to {APP_NAME}</CardTitle>
          <CardDescription>Pick your school to see subleases near campus.</CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm schools={schools} />
        </CardContent>
      </Card>
    </main>
  );
}
