import {
  Bath,
  BedDouble,
  Check,
  ChevronLeft,
  House,
  Lock,
  MapPin,
  ShieldCheck,
  Sofa,
  UserRound,
  Users,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cache, type ReactNode } from 'react';
import { FavoriteButton } from '@/app/_components/favorite-button';
import { ListingBadge } from '@/app/_components/listing-badge';
import { MessageHostButton } from '@/app/_components/message-host-button';
import { ReportButton } from '@/app/_components/report-button';
import { TermTimelineBar } from '@/app/_components/term-timeline';
import { orNotFound } from '@/app/_lib/guards';
import { buttonVariants } from '@/components/ui/button';
import {
  formatDate,
  formatDateRange,
  formatDistanceKm,
  formatMonthYear,
  formatRent,
} from '@/lib/format';
import {
  AMENITY_LABELS,
  GENDER_PREFERENCE_LABELS,
  LISTING_TYPE_LABELS,
  ROOM_FEATURE_LABELS,
  ROOM_TYPE_LABELS,
  roommatesLabel,
} from '@/lib/listing-options';
import { listingBadges } from '@/lib/listing-rules';
import { SAFETY_NOTICE } from '@/lib/messaging-options';
import { getActor } from '@/server/auth/get-actor';
import { getListingDetail } from '@/server/services/listing-reads';
import { getActiveSchoolBySlug, schoolBrand } from '@/server/services/schools';
import { ListingMap } from './listing-map';
import { PhotoGallery } from './photo-gallery';

type ListingPageProps = { params: Promise<{ school: string; id: string }> };

const loadListing = cache(async (id: string) => orNotFound(getListingDetail(await getActor(), id)));

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-7">
      <h2 className="varsity text-[1.75rem] font-extrabold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function ListingPage({ params }: ListingPageProps) {
  const { school, id } = await params;
  const listing = await loadListing(id);
  const actor = await getActor();
  if (listing.school.slug !== school) redirect(`/${listing.school.slug}/listings/${listing.id}`);
  // An inactive school still shows its own non-public listings to owners and admins.
  const brandRow = await getActiveSchoolBySlug(listing.school.slug).catch(() => null);
  const brand = brandRow ? schoolBrand(brandRow) : null;
  const campusName = brand?.campusName ?? listing.school.name;
  const visitor = listing.viewer === 'visitor';
  const canInteract = visitor && !listing.crossSchool;

  const facts: { icon: ReactNode; label: string; value: string }[] = [
    { icon: <House />, label: 'Type', value: LISTING_TYPE_LABELS[listing.type] },
    {
      icon: <BedDouble />,
      label: 'Bedrooms',
      value: listing.bedrooms === 0 ? 'Studio' : String(listing.bedrooms),
    },
    { icon: <Bath />, label: 'Bathrooms', value: String(listing.bathrooms) },
    { icon: <Users />, label: 'Roommates', value: roommatesLabel(listing.roommatesCount) },
    { icon: <BedDouble />, label: 'Room type', value: ROOM_TYPE_LABELS[listing.roomType] },
    { icon: <Sofa />, label: 'Furnished', value: listing.furnished ? 'Yes' : 'No' },
    ...(listing.privateBathroom === null
      ? []
      : [
          {
            icon: <Bath />,
            label: 'Your bathroom',
            value: listing.privateBathroom ? 'Private' : 'Shared',
          },
        ]),
    ...(listing.genderPreference === 'any'
      ? []
      : [
          {
            icon: <UserRound />,
            label: 'Prefers',
            value: GENDER_PREFERENCE_LABELS[listing.genderPreference],
          },
        ]),
  ];
  const street = listing.unit ? `${listing.address}, Unit ${listing.unit}` : listing.address;
  const cityLine = `${listing.city}, ${listing.state} ${listing.zip}`;
  const distance = `${formatDistanceKm(listing.distanceKm)} to ${campusName}`;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-5 pb-16 sm:px-6 lg:px-8">
      <Link
        href={`/${listing.school.slug}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-ink no-underline hover:underline"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        All {brand?.shortName ?? listing.school.name} listings
      </Link>

      {!visitor && !listing.isPublic && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-school-tint px-4 py-3 text-sm text-ink">
          <div className="flex flex-wrap gap-2">
            {listingBadges(listing).map((badge) => (
              <ListingBadge key={badge.label} badge={badge} />
            ))}
          </div>
          <p>Only you{listing.viewer === 'admin' ? ' (admin)' : ''} can see this page right now.</p>
          {listing.viewer === 'owner' && (
            <Link href={`/listings/${listing.id}/edit`} className="font-semibold text-school-link">
              Edit listing
            </Link>
          )}
        </div>
      )}

      <div className="mt-4">
        <PhotoGallery photos={listing.photos} title={listing.title} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:gap-x-14 lg:gap-y-8">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div>
            <h1 className="varsity text-[clamp(2.25rem,4.4vw,3.5rem)] font-black">
              {listing.title}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-ink-2">
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-4" />
                <span className="text-ink">{street}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>{cityLine}</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-ink">{distance}</span>
            </p>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <div className="overflow-hidden rounded-md border border-line-2 shadow-[0_6px_24px_rgb(21_23_28/0.07)]">
            <div className="on-school bg-school px-5 pt-5 text-on-school">
              <p className="flex items-baseline gap-1.5">
                <span className="numeral text-[3.75rem]">
                  {usd.format(listing.rentCents / 100)}
                </span>
                <span className="text-sm font-medium">/ month</span>
              </p>
              <div aria-hidden="true" className="varsity-stripe mt-4 border-b-0" />
            </div>
            <div className="grid gap-4 p-5">
              <dl className="grid grid-cols-2 rounded-md border border-line-2">
                <div className="px-3 py-2.5">
                  <dt className="varsity text-xs font-bold tracking-[0.08em] text-ink-2">
                    Move in
                  </dt>
                  <dd className="mt-1 text-[15px] font-semibold text-ink">
                    {formatDate(listing.availableFrom)}
                  </dd>
                </div>
                <div className="border-l border-line-2 px-3 py-2.5">
                  <dt className="varsity text-xs font-bold tracking-[0.08em] text-ink-2">
                    Move out
                  </dt>
                  <dd className="mt-1 text-[15px] font-semibold text-ink">
                    {formatDate(listing.availableTo)}
                  </dd>
                </div>
              </dl>
              {listing.crossSchool && (
                <p className="flex gap-2.5 rounded-md bg-surface-2 p-3 text-sm text-ink-2">
                  <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  This listing is at another school. You can look around, but messaging, saving, and
                  reporting are only available for listings at your own school.
                </p>
              )}
              {canInteract && (
                <MessageHostButton
                  listingId={listing.id}
                  conversationId={listing.conversationId}
                  signedIn={actor.kind === 'user'}
                />
              )}
              {canInteract && (
                <FavoriteButton
                  listingId={listing.id}
                  listingTitle={listing.title}
                  initialFavorited={listing.isFavorited}
                  signedIn={actor.kind === 'user'}
                  withText
                  className="w-full"
                />
              )}
              {listing.viewer === 'owner' && (
                <Link
                  href={`/listings/${listing.id}/edit`}
                  className={buttonVariants({ variant: 'outline', size: 'lg' })}
                >
                  Edit your listing
                </Link>
              )}
              <div className="flex items-center gap-3 border-t border-line pt-4">
                <span
                  aria-hidden="true"
                  className="varsity grid size-11 shrink-0 place-items-center rounded-full bg-school-tint text-lg font-extrabold text-school"
                >
                  {listing.host.displayName.slice(0, 1)}
                </span>
                <p className="text-sm text-ink-2">
                  <span className="block text-[15px] font-semibold text-ink">
                    Hosted by {listing.host.displayName}
                  </span>
                  Student host · joined {formatMonthYear(listing.host.joinedAt)}
                </p>
              </div>
              <p className="flex gap-2.5 rounded-md bg-surface-2 p-3 text-[13px] leading-snug text-ink-2">
                <ShieldCheck aria-hidden="true" className="mt-px size-4 shrink-0 text-ok" />
                {SAFETY_NOTICE}
              </p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-2">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
            {facts.map((fact) => (
              <div key={fact.label} className="flex gap-3">
                <span aria-hidden="true" className="mt-0.5 text-ink-2 [&_svg]:size-5">
                  {fact.icon}
                </span>
                <div>
                  <dt className="text-[13px] text-ink-2">{fact.label}</dt>
                  <dd className="text-[15px] font-semibold text-ink">{fact.value}</dd>
                </div>
              </div>
            ))}
          </dl>

          <Section title="About this place">
            <p className="max-w-[68ch] text-[15px] leading-relaxed whitespace-pre-line text-ink">
              {listing.description}
            </p>
          </Section>

          <Section title="Availability">
            <p className="text-[15px] font-semibold text-ink">
              {formatDate(listing.availableFrom)} to {formatDate(listing.availableTo)}
            </p>
            <TermTimelineBar from={listing.availableFrom} to={listing.availableTo} size="full" />
          </Section>

          {listing.roomFeatures.length > 0 && (
            <Section title="The room">
              <ul className="grid gap-x-6 gap-y-3 text-[15px] text-ink sm:grid-cols-2">
                {listing.roomFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5">
                    <Check aria-hidden="true" className="size-4 text-ok" />
                    {ROOM_FEATURE_LABELS[feature]}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {listing.amenities.length > 0 && (
            <Section title="Amenities">
              <ul className="grid gap-x-6 gap-y-3 text-[15px] text-ink sm:grid-cols-2">
                {listing.amenities.map((amenity) => (
                  <li key={amenity} className="flex items-center gap-2.5">
                    <Check aria-hidden="true" className="size-4 text-ok" />
                    {AMENITY_LABELS[amenity]}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Location">
            <ListingMap
              listing={listing.location}
              campus={listing.school.campusLocation}
              campusName={campusName}
            />
            <p className="mt-3 text-[15px] text-ink">
              <span className="font-semibold">{cityLine}</span>
              <span className="text-ink-2"> · {distance}</span>
            </p>
            {visitor && !listing.unit && (
              <p className="mt-2 flex items-center gap-2 text-sm text-ink-2">
                <Lock aria-hidden="true" className="size-4" />
                Unit numbers are shown only to students in a conversation with the host.
              </p>
            )}
          </Section>

          {canInteract && actor.kind === 'user' && (
            <div className="border-t border-line pt-5">
              <ReportButton
                targetType="listing"
                targetId={listing.id}
                label="Report listing"
                title="Report listing"
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
