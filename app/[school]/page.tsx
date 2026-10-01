import type { Metadata } from 'next';
import { orNotFound } from '@/app/_lib/guards';
import { getActiveSchoolBySlug } from '@/server/services/schools';

type SchoolPageProps = { params: Promise<{ school: string }> };

export async function generateMetadata({ params }: SchoolPageProps): Promise<Metadata> {
  const school = await orNotFound(getActiveSchoolBySlug((await params).school));
  return { title: `Subleases near ${school.name}` };
}

export default async function SchoolPage({ params }: SchoolPageProps) {
  const school = await orNotFound(getActiveSchoolBySlug((await params).school));
  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Subleases near {school.name}</h1>
      <p className="mt-4 text-muted-foreground">No listings yet.</p>
    </main>
  );
}
