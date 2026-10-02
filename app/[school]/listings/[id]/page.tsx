import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { ListingBadge } from '@/app/_components/listing-badge';
import { orNotFound } from '@/app/_lib/guards';
import { formatDateRange, formatDistanceKm, formatMonthYear, formatRent } from '@/lib/format';
import {
  AMENITY_LABELS,
  GENDER_PREFERENCE_LABELS,
  LISTING_TYPE_LABELS,
} from '@/lib/listing-options';
import { listingBadges } from '@/lib/listing-rules';
import { getActor } from '@/server/auth/get-actor';
import { getListingDetail } from '@/server/services/listing-reads';
import { ListingMap } from './listing-map';

type ListingPageProps = { params: Promise<{ school: string; id: string }> };

const loadListing = cache(async (id: string) => orNotFound(getListingDetail(await getActor(), id)));

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const listing = await loadListing((await params).id);
  const cover = listing.photos[0];
  return {
    title: listing.title,
    robots: { index: false, follow: false },
    openGraph: {
      title: `${listing.title} · ${formatRent(listing.rentCents)}`,
      description: `${LISTING_TYPE_LABELS[listing.type]} near ${listing.school.name}, ${formatDateRange(listing.availableFrom, listing.availableTo)}`,
      images: cover ? [{ url: cover.galleryUrl }] : [],
    },
  };
}

export default async function ListingPage({ params }: ListingPageProps) {
  const { school, id } = await params;
  const listing = await loadListing(id);
  if (listing.school.slug !== school) redirect(`/${listing.school.slug}/listings/${listing.id}`);

  const facts = [
    LISTING_TYPE_LABELS[listing.type],
    listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms} bed`,
    `${listing.bathrooms} bath`,
    listing.roommatesCount === 0
      ? 'No roommates'
      : `${listing.roommatesCount} roommate${listing.roommatesCount === 1 ? '' : 's'}`,
    listing.furnished ? 'Furnished' : 'Unfurnished',
    ...(listing.privateBathroom === null
      ? []
      : [listing.privateBathroom ? 'Private bathroom' : 'Shared bathroom']),
    ...(listing.genderPreference === 'any'
      ? []
      : [`Prefers: ${GENDER_PREFERENCE_LABELS[listing.genderPreference]}`]),
  ];
  const street = listing.unit ? `${listing.address}, Unit ${listing.unit}` : listing.address;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      {listing.viewer !== 'visitor' && !listing.isPublic && (
        <div className="mb-6 space-y-2 rounded-lg border bg-muted p-4 text-sm">
          <div className="flex flex-wrap gap-2">
            {listingBadges(listing).map((badge) => (
              <ListingBadge key={badge.label} badge={badge} />
            ))}
          </div>
          <p>Only you{listing.viewer === 'admin' ? ' (admin)' : ''} can see this page right now.</p>
          {listing.viewer === 'owner' && (
            <Link href={`/listings/${listing.id}/edit`} className="underline">
              Edit listing
            </Link>
          )}
        </div>
      )}

      {listing.photos.length > 0 ? (
        <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          {listing.photos.map((photo, index) => (
            <li
              key={photo.id}
              className="relative aspect-[4/3] w-[85%] shrink-0 snap-start overflow-hidden rounded-xl bg-muted sm:w-[60%]"
            >
              <Image
                src={photo.galleryUrl}
                alt={index === 0 ? listing.title : ''}
                fill
                priority={index === 0}
                sizes="(min-width: 1024px) 600px, 85vw"
                className="object-cover"
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="aspect-[16/9] rounded-xl bg-muted" />
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
            <p className="mt-1 text-lg">{formatRent(listing.rentCents)}</p>
            <p className="text-muted-foreground">
              {formatDateRange(listing.availableFrom, listing.availableTo)}
            </p>
          </div>
          <ul className="flex flex-wrap gap-2 text-sm">
            {facts.map((fact) => (
              <li key={fact} className="rounded-full border px-3 py-1">
                {fact}
              </li>
            ))}
          </ul>
          <p className="whitespace-pre-line">{listing.description}</p>
          {listing.amenities.length > 0 && (
            <section>
              <h2 className="font-medium">Amenities</h2>
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {listing.amenities.map((amenity) => (
                  <li key={amenity}>{AMENITY_LABELS[amenity]}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="space-y-1 text-sm">
            <p className="font-medium">{street}</p>
            <p>
              {listing.city}, {listing.state} {listing.zip}
            </p>
            <p className="text-muted-foreground">
              {formatDistanceKm(listing.distanceKm)} from {listing.school.name}
            </p>
          </div>
          <ListingMap listing={listing.location} campus={listing.school.campusLocation} />
          <p className="text-sm text-muted-foreground">
            Hosted by {listing.host.displayName} · joined {formatMonthYear(listing.host.joinedAt)}
          </p>
        </aside>
      </div>
    </main>
  );
}
