import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { APP_NAME } from '@/lib/app-config';
import { getActor } from '@/server/auth/get-actor';
import { listActiveSchools } from '@/server/services/schools';
import { getOnboardingState } from '@/server/services/users';

export default async function HomePage() {
  const actor = await getActor();
  if (actor.kind === 'user') {
    const state = await getOnboardingState(actor);
    if (state.needsOnboarding) redirect('/onboarding');
    if (state.homeSchoolSlug) redirect(`/${state.homeSchoolSlug}`);
  }
  const schools = await listActiveSchools();
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Find a sublease near campus</h1>
      <p className="mt-2 text-muted-foreground">
        {APP_NAME} is for students subleasing their own place. Pick your school to start.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {schools.map((school) => (
          <li key={school.id}>
            <Link href={`/${school.slug}`} className="block rounded-xl focus-visible:outline-2">
              <Card className="h-full transition-colors hover:bg-accent">
                <CardHeader>
                  <CardTitle>{school.name}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
