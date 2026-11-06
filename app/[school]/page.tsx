import { House, SearchX } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { SchoolBand } from '@/app/_components/school-band';
import { todayIso } from '@/lib/term-timeline';
import { orNotFound } from '@/app/_lib/guards';
import { buttonVariants } from '@/components/ui/button';
import {
  hasActiveFilters,
  parseSearchParams,
  toSearchParams,
  type RawSearchParams,
} from '@/lib/validation/search';
import { getActor } from '@/server/auth/get-actor';
import { getActiveSchoolBySlug, listActiveSchools, schoolBrand } from '@/server/services/schools';
import { searchListings, searchMapPins } from '@/server/services/search';
import { getOnboardingState } from '@/server/services/users';
import { ActiveFilters } from './_components/active-filters';
import { BrowseFilters } from './_components/browse-filters';
import { BrowseView } from './_components/browse-view';
import { SchoolSwitcher } from './_components/school-switcher';

type SchoolPageProps = {
  params: Promise<{ school: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params }: SchoolPageProps): Promise<Metadata> {
  const school = await orNotFound(getActiveSchoolBySlug((await params).school));
  return {
    title: `Subleases near ${school.name}`,
    alternates: { canonical: `/${school.slug}` },
  };
}

export default async function SchoolPage({ params, searchParams }: SchoolPageProps) {
  const [school, raw, actor] = await Promise.all([
    params.then(({ school: slug }) => orNotFound(getActiveSchoolBySlug(slug))),
    searchParams,
    getActor(),
  ]);
  // Students are locked to their home school; only admins browse the others.
  if (actor.kind === 'user' && !actor.isAdmin) {
    const { homeSchoolSlug } = await getOnboardingState(actor);
    if (homeSchoolSlug && homeSchoolSlug !== school.slug) redirect(`/${homeSchoolSlug}`);
  }
  const switchable = actor.kind === 'user' && actor.isAdmin ? await listActiveSchools() : null;
  const filters = parseSearchParams(raw);
  const query = toSearchParams(filters).toString();
  const [results, pins] = await Promise.all([
    searchListings(actor, { schoolId: school.id, filters }),
    searchMapPins(actor, { schoolId: school.id, filters }),
  ]);

  const brand = schoolBrand(school);
  const empty = hasActiveFilters(filters) ? (
    <EmptyState
      icon={<SearchX aria-hidden="true" className="size-6" />}
      title="No listings match these filters."
      body="Try a wider price range, different dates, or fewer amenities."
      action={
        <Link href={`/${school.slug}`} className={buttonVariants({ variant: 'outline' })}>
          Clear filters
        </Link>
      }
    />
  ) : (
    <EmptyState
      icon={<House aria-hidden="true" className="size-6" />}
      title={`No listings near ${school.name} yet.`}
      body={`Leaving ${brand.campusName} for a semester or the summer? Yours could be the first.`}
      action={
        <Link href="/listings/new" className={buttonVariants()}>
          Post a listing
        </Link>
      }
    />
  );

  return (
    <main className="w-full">
      <SchoolBand
        school={brand}
        heading={`Subleases near ${school.name}`}
        aside={
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            {switchable && <SchoolSwitcher current={school.slug} schools={switchable} />}
            <p className="sm:text-right">
              <b className="numeral block text-[2.125rem]">{results.total}</b>
              <span className="text-[13px]">{results.total === 1 ? 'listing' : 'listings'}</span>
            </p>
          </div>
        }
      />
      <div className="z-20 border-b border-line bg-background md:sticky md:top-0">
        <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <BrowseFilters key={query} schoolSlug={school.slug} filters={filters} />
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 pt-5 pb-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <p className="text-sm font-semibold text-ink" aria-live="polite">
            <span>
              {results.total} listing{results.total === 1 ? '' : 's'}
            </span>{' '}
            <span className="font-normal text-ink-2">near {brand.campusName}</span>
          </p>
          <ActiveFilters schoolSlug={school.slug} filters={filters} />
        </div>
        <BrowseView
          school={{
            id: school.id,
            slug: school.slug,
            campus: school.campusLocation,
            campusName: brand.campusName,
            timelineStart: todayIso(),
            zoom: school.defaultMapZoom,
          }}
          filters={filters}
          query={query}
          results={results}
          pins={pins}
          signedIn={actor.kind === 'user'}
          empty={empty}
        />
      </div>
    </main>
  );
}

type EmptyStateProps = { icon: ReactNode; title: string; body: string; action: ReactNode };

function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-md bg-surface-2 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-school-tint text-school">
        {icon}
      </span>
      <p className="varsity mt-4 text-[1.625rem] font-extrabold">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-ink-2">{body}</p>
      <div className="mt-5">{action}</div>
    </div>
  );
}
