import type { Metadata } from 'next';
import Link from 'next/link';
import { orNotFound } from '@/app/_lib/guards';
import {
  hasActiveFilters,
  parseSearchParams,
  toSearchParams,
  type RawSearchParams,
} from '@/lib/validation/search';
import { getActor } from '@/server/auth/get-actor';
import { getActiveSchoolBySlug } from '@/server/services/schools';
import { searchListings, searchMapPins } from '@/server/services/search';
import { BrowseFilters } from './_components/browse-filters';
import { BrowseView } from './_components/browse-view';

type SchoolPageProps = {
  params: Promise<{ school: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params }: SchoolPageProps): Promise<Metadata> {
  const school = await orNotFound(getActiveSchoolBySlug((await params).school));
  return { title: `Subleases near ${school.name}` };
}

export default async function SchoolPage({ params, searchParams }: SchoolPageProps) {
  const [school, raw, actor] = await Promise.all([
    params.then(({ school: slug }) => orNotFound(getActiveSchoolBySlug(slug))),
    searchParams,
    getActor(),
  ]);
  const filters = parseSearchParams(raw);
  const query = toSearchParams(filters).toString();
  const [results, pins] = await Promise.all([
    searchListings(actor, { schoolId: school.id, filters }),
    searchMapPins(actor, { schoolId: school.id, filters }),
  ]);

  const empty = hasActiveFilters(filters) ? (
    <div className="rounded-xl border p-8 text-center">
      <p className="font-medium">No listings match these filters.</p>
      <Link href={`/${school.slug}`} className="mt-2 inline-block text-sm underline">
        Clear filters
      </Link>
    </div>
  ) : (
    <div className="rounded-xl border p-8 text-center">
      <p className="font-medium">No listings near {school.name} yet.</p>
      <Link href="/listings/new" className="mt-2 inline-block text-sm underline">
        Post a listing
      </Link>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Subleases near {school.name}</h1>
      <div className="mt-4">
        <BrowseFilters key={query} schoolSlug={school.slug} filters={filters} />
      </div>
      <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
        {results.total} listing{results.total === 1 ? '' : 's'}
      </p>
      <BrowseView
        school={{
          id: school.id,
          slug: school.slug,
          campus: school.campusLocation,
          zoom: school.defaultMapZoom,
        }}
        filters={filters}
        query={query}
        results={results}
        pins={pins}
        signedIn={actor.kind === 'user'}
        empty={empty}
      />
    </main>
  );
}
