import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { APP_NAME } from '@/lib/app-config';
import { schoolThemeStyle } from '@/lib/school-theme';
import { getActor } from '@/server/auth/get-actor';
import { listActiveSchools } from '@/server/services/schools';
import { getOnboardingState } from '@/server/services/users';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const actor = await getActor();
  if (actor.kind === 'user') {
    const state = await getOnboardingState(actor);
    if (state.needsOnboarding) redirect('/onboarding');
    if (state.homeSchoolSlug) redirect(`/${state.homeSchoolSlug}`);
  }
  const schools = await listActiveSchools();
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <h1 className="varsity text-[clamp(2.5rem,5vw,3.75rem)] font-black text-ink">
        Find a sublease near campus
      </h1>
      <p className="mt-3 max-w-[60ch] text-[16px] text-ink-2">
        {APP_NAME} is for students subleasing their own place. Pick your school to start.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {schools.map((school) => (
          <li key={school.id} style={schoolThemeStyle(school.theme)}>
            <Link
              href={`/${school.slug}`}
              className="group flex h-full min-h-40 flex-col rounded-md bg-school px-5 pt-5 text-on-school no-underline transition-[background-color,transform] duration-300 ease-out-expo hover:-translate-y-0.5 hover:bg-school-deep"
            >
              <span className="varsity text-[2.5rem] font-black">{school.shortName}</span>
              <span className="mt-2 text-sm">{school.name}</span>
              <span className="mt-auto flex items-center justify-between py-4 text-sm font-semibold">
                Browse listings
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                />
              </span>
              <span aria-hidden="true" className="varsity-stripe -mx-5 mb-3 block" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
