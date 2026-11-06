import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ListingBadge } from '@/app/_components/listing-badge';
import { requireOnboardedUser } from '@/app/_lib/guards';
import { formatDateRange } from '@/lib/format';
import { MAX_ACTIVE_LISTINGS } from '@/lib/listing-options';
import { listingCap } from '@/lib/listing-rules';
import { listingBadges } from '@/lib/listing-rules';
import { cn } from '@/lib/utils';
import { listMyListings, type MyListing } from '@/server/services/listing-reads';
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

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

// Mirrors the cap rule: active, not expired, and not rejected listings use a slot.
const usesSlot = (listing: MyListing) =>
  listing.status === 'active' && !listing.isExpired && listing.reviewStatus !== 'rejected';

type MyListingsPageProps = { searchParams: Promise<{ notice?: string }> };

export default async function MyListingsPage({ searchParams }: MyListingsPageProps) {
  const actor = await requireOnboardedUser();
  const [{ notice }, mine] = await Promise.all([searchParams, listMyListings(actor)]);
  const message = notice ? NOTICES[notice] : undefined;
  const cap = listingCap(actor.isAdmin);
  const slotted = mine.filter(usesSlot).slice(0, cap);
  const others = mine.filter((listing) => !slotted.includes(listing));
  // Admins have no cap, so one "post" tile always shows.
  const open = actor.isAdmin ? 1 : Math.max(cap - slotted.length, 0);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <h1 className="varsity text-[clamp(2.75rem,6vw,4rem)] font-black text-ink">My listings</h1>
      <p className="mt-3 text-[16px] text-ink-2">
        {actor.isAdmin ? (
          <span className="font-semibold text-ink">Admins have no listing limit.</span>
        ) : (
          <>
            You can have {MAX_ACTIVE_LISTINGS} active {MAX_ACTIVE_LISTINGS === 1 ? 'listing' : 'listings'}.{' '}
            <span className="font-semibold text-ink">
              {open === 0 ? 'Your slot is in use.' : 'Your slot is open.'}
            </span>
          </>
        )}
      </p>
      {message && (
        <p role="status" className="mt-6 rounded-md bg-ok-bg px-4 py-3 text-sm font-medium text-ok">
          {message}
        </p>
      )}

      <h2 className="sr-only">Active listings</h2>
      <ul className="mt-8 grid gap-5 lg:grid-cols-2">
        {slotted.map((listing) => (
          <ListingSlot key={listing.id} listing={listing} />
        ))}
        {Array.from({ length: open }, (_, i) => (
          <li key={`open-${i}`}>
            <Link
              href="/listings/new"
              className="group flex h-full min-h-56 flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-line-2 bg-surface-2 p-6 text-center text-ink no-underline transition-colors hover:border-school hover:bg-school-tint"
            >
              <span className="grid size-12 place-items-center rounded-full bg-school text-on-school">
                <Plus aria-hidden="true" className="size-6" />
              </span>
              <span className="varsity text-[1.625rem] font-extrabold">Post a listing</span>
              <span className="max-w-[34ch] text-sm text-ink-2">
                Reviewed by a person, usually within 24 hours.
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {others.length > 0 && (
        <section className="mt-14" aria-labelledby="past-heading">
          <h2 id="past-heading" className="varsity text-[1.75rem] font-extrabold text-ink">
            Past and inactive
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Taken, removed, expired, and rejected listings don&apos;t use a slot.
          </p>
          <ul className="mt-5 divide-y divide-line rounded-md border border-line">
            {others.map((listing) => (
              <li key={listing.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <Cover listing={listing} className="w-full sm:w-32" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Title listing={listing} />
                  <p className="text-sm text-ink-2">
                    <span className="numeral text-[1.125rem] text-ink">
                      {usd.format(listing.rentCents / 100)}
                    </span>
                    /month · {formatDateRange(listing.availableFrom, listing.availableTo)}
                  </p>
                  <Badges listing={listing} />
                </div>
                <ListingRowActions
                  listingId={listing.id}
                  status={listing.status}
                  reviewStatus={listing.reviewStatus}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function ListingSlot({ listing }: { listing: MyListing }) {
  return (
    <li className="flex flex-col overflow-hidden rounded-md border border-line sm:flex-row">
      <Cover listing={listing} className="w-full rounded-none sm:w-56" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-5">
        <Badges listing={listing} />
        <p className="flex items-baseline gap-1">
          <span className="numeral text-[2.25rem] text-ink">
            {usd.format(listing.rentCents / 100)}
          </span>
          <span className="text-[13px] font-medium text-ink-2">/ month</span>
        </p>
        <Title listing={listing} />
        <p className="text-sm text-ink-2">
          {formatDateRange(listing.availableFrom, listing.availableTo)}
        </p>
        <div className="mt-auto pt-2">
          <ListingRowActions
            listingId={listing.id}
            status={listing.status}
            reviewStatus={listing.reviewStatus}
          />
        </div>
      </div>
    </li>
  );
}

function Cover({ listing, className }: { listing: MyListing; className?: string }) {
  return (
    <div
      className={cn(
        'relative aspect-[4/3] shrink-0 overflow-hidden rounded-md bg-surface-2',
        className,
      )}
    >
      {listing.coverThumbUrl && (
        <Image src={listing.coverThumbUrl} alt="" fill sizes="224px" className="object-cover" />
      )}
    </div>
  );
}

function Title({ listing }: { listing: MyListing }) {
  return (
    <Link
      href={`/${listing.schoolSlug}/listings/${listing.id}`}
      className="block truncate text-[15px] font-semibold text-ink no-underline hover:underline"
    >
      {listing.title}
    </Link>
  );
}

function Badges({ listing }: { listing: MyListing }) {
  return (
    <div className="flex flex-wrap gap-2">
      {listingBadges(listing).map((badge) => (
        <ListingBadge key={badge.label} badge={badge} />
      ))}
    </div>
  );
}
