import type { Metadata } from 'next';
import { ListingTile } from '@/app/_components/listing-tile';
import { requireOnboardedUser } from '@/app/_lib/guards';
import { listFavorites } from '@/server/services/favorites';

export const metadata: Metadata = {
  title: 'Saved listings',
  robots: { index: false, follow: false },
};

export default async function FavoritesPage() {
  const actor = await requireOnboardedUser();
  const saved = await listFavorites(actor);
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Saved listings</h1>
      {saved.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          Nothing saved yet. Use the heart on a listing to save it here.
        </p>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {saved.map((card) => (
            <li key={card.id}>
              <ListingTile card={card} signedIn />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
