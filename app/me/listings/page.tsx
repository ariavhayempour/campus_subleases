import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ListingBadge } from '@/app/_components/listing-badge';
import { requireOnboardedUser } from '@/app/_lib/guards';
import { Button } from '@/components/ui/button';
import { formatDateRange, formatRent } from '@/lib/format';
import { listingBadges } from '@/lib/listing-rules';
import { listMyListings } from '@/server/services/listing-reads';
import { ListingRowActions } from './listing-row-actions';

export const metadata: Metadata = {
  title: 'My listings',
  robots: { index: false, follow: false },
};

const NOTICES: Record<string, string> = {
  created: 'Thanks! Your listing is under review and usually goes live within 24 hours.',
  'in-review': 'Saved. Your listing is under review and usually goes live within 24 hours.',
  saved: 'Saved.',
};

type MyListingsPageProps = { searchParams: Promise<{ notice?: string }> };

export default async function MyListingsPage({ searchParams }: MyListingsPageProps) {
  const actor = await requireOnboardedUser();
  const [{ notice }, mine] = await Promise.all([searchParams, listMyListings(actor)]);
  const message = notice ? NOTICES[notice] : undefined;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">My listings</h1>
        <Button asChild>
          <Link href="/listings/new">Post a listing</Link>
        </Button>
      </div>
      {message && (
        <p role="status" className="mt-6 rounded-lg border bg-muted p-3 text-sm">
          {message}
        </p>
      )}
      {mine.length === 0 ? (
        <p className="mt-8 text-muted-foreground">You haven’t posted a listing yet.</p>
      ) : (
        <ul className="mt-8 divide-y rounded-xl border">
          {mine.map((listing) => (
            <li key={listing.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md bg-muted sm:w-40">
                {listing.coverThumbUrl && (
                  <Image
                    src={listing.coverThumbUrl}
                    alt=""
                    fill
                    sizes="160px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <Link
                  href={`/${listing.schoolSlug}/listings/${listing.id}`}
                  className="font-medium hover:underline"
                >
                  {listing.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {formatRent(listing.rentCents)} ·{' '}
                  {formatDateRange(listing.availableFrom, listing.availableTo)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {listingBadges(listing).map((badge) => (
                    <ListingBadge key={badge.label} badge={badge} />
                  ))}
                </div>
              </div>
              <ListingRowActions
                listingId={listing.id}
                status={listing.status}
                reviewStatus={listing.reviewStatus}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
