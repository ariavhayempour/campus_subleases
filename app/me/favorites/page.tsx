import { Heart } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ListingTile } from '@/app/_components/listing-tile';
import { todayIso } from '@/lib/term-timeline';
import { getThemeContext } from '@/app/_lib/theme-school';
import { requireOnboardedUser } from '@/app/_lib/guards';
import { buttonVariants } from '@/components/ui/button';
import { listFavorites } from '@/server/services/favorites';

export const metadata: Metadata = {
  title: 'Saved listings',
  robots: { index: false, follow: false },
};

export default async function FavoritesPage() {
  const actor = await requireOnboardedUser();
  const [saved, { schools, school: home }] = await Promise.all([
    listFavorites(actor),
    getThemeContext(),
  ]);
  // Each tile names its own school's campus; admins can save across schools.
  const campusOf = (slug: string) => schools.find((s) => s.slug === slug)?.campusName;
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <h1 className="varsity text-[clamp(2.5rem,5vw,3.75rem)] font-black">Saved listings</h1>
      <p className="mt-2 text-[15px] text-ink-2">
        {saved.length === 0
          ? 'Save places while you browse, then compare them here.'
          : `${saved.length} saved ${saved.length === 1 ? 'place' : 'places'}.`}
      </p>
      {saved.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-md bg-surface-2 px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-school-tint text-school">
            <Heart aria-hidden="true" className="size-6" />
          </span>
          <p className="varsity mt-4 text-[1.625rem] font-extrabold">Nothing saved yet</p>
          <p className="mt-2 max-w-sm text-sm text-ink-2">
            Use the heart on a listing to save it here.
          </p>
          {home && (
            <Link href={`/${home.slug}`} className={`${buttonVariants()} mt-5`}>
              Browse {home.shortName} listings
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-8 grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {saved.map((card) => (
            <li key={card.id}>
              <ListingTile
                card={card}
                signedIn
                campusName={campusOf(card.schoolSlug)}
                timelineStart={todayIso()}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
