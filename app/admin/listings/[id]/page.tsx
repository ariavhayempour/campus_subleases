import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ListingBadge } from '@/app/_components/listing-badge';
import { LocalTime } from '@/app/_components/local-time';
import { orAdminNotFound } from '@/app/_lib/guards';
import { ACTION_LABELS, summarizeSnapshot } from '@/lib/audit-labels';
import { formatDateRange, formatMonthYear, formatRent } from '@/lib/format';
import {
  AMENITY_LABELS,
  GENDER_PREFERENCE_LABELS,
  LISTING_TYPE_LABELS,
} from '@/lib/listing-options';
import { listingBadges } from '@/lib/listing-rules';
import {
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  USER_STATUS_LABELS,
} from '@/lib/moderation-options';
import { getActor } from '@/server/auth/get-actor';
import { getAdminListing } from '@/server/services/admin-listings';
import { ReviewActions } from '../../_components/review-actions';

export const metadata: Metadata = { title: 'Admin · Listing' };

type AdminListingPageProps = { params: Promise<{ id: string }> };

export default async function AdminListingPage({ params }: AdminListingPageProps) {
  const { id } = await params;
  const view = await orAdminNotFound(getAdminListing(await getActor(), id));
  const { detail: listing, owner } = view;

  const flags = [
    view.autoHidden ? 'Auto-hidden' : null,
    view.farFromCampusKm === null ? null : `Far from campus: ${view.farFromCampusKm.toFixed(1)} km`,
  ].filter((flag): flag is string => flag !== null);
  const facts = [
    LISTING_TYPE_LABELS[listing.type],
    listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms} bed`,
    `${listing.bathrooms} bath`,
    `${listing.roommatesCount} roommate${listing.roommatesCount === 1 ? '' : 's'}`,
    listing.furnished ? 'Furnished' : 'Unfurnished',
    ...(listing.privateBathroom === null
      ? []
      : [listing.privateBathroom ? 'Private bathroom' : 'Shared bathroom']),
    `Prefers: ${GENDER_PREFERENCE_LABELS[listing.genderPreference]}`,
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href="/admin/listings" className="text-sm underline">
          Back to listings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {listingBadges(listing).map((badge) => (
            <ListingBadge key={badge.label} badge={badge} />
          ))}
          {flags.map((flag) => (
            <span key={flag} className="text-sm text-amber-700 dark:text-amber-300">
              {flag}
            </span>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-[1fr_20rem] gap-8">
        <section aria-labelledby="preview-heading" className="min-w-0 space-y-4">
          <h2 id="preview-heading" className="text-lg font-medium">
            Preview
          </h2>
          {listing.photos.length > 0 && (
            <ul className="grid grid-cols-4 gap-2">
              {listing.photos.map((photo) => (
                <li
                  key={photo.id}
                  className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted"
                >
                  <Image src={photo.thumbUrl} alt="" fill sizes="160px" className="object-cover" />
                </li>
              ))}
            </ul>
          )}
          <p>
            {formatRent(listing.rentCents)} ·{' '}
            {formatDateRange(listing.availableFrom, listing.availableTo)}
          </p>
          <p className="text-sm">
            {listing.address}
            {listing.unit ? `, Unit ${listing.unit}` : ''}, {listing.city}, {listing.state}{' '}
            {listing.zip} · {listing.school.name}
          </p>
          <ul className="flex flex-wrap gap-2 text-sm">
            {facts.map((fact) => (
              <li key={fact} className="rounded-full border px-3 py-1">
                {fact}
              </li>
            ))}
          </ul>
          <p className="whitespace-pre-line">{listing.description}</p>
          {listing.amenities.length > 0 && (
            <p className="text-sm">
              Amenities: {listing.amenities.map((amenity) => AMENITY_LABELS[amenity]).join(', ')}
            </p>
          )}
          {listing.reviewNote && <p className="text-sm">Review note: {listing.reviewNote}</p>}
        </section>

        <aside className="space-y-8">
          <section aria-labelledby="owner-heading" className="space-y-1 text-sm">
            <h2 id="owner-heading" className="text-lg font-medium">
              Owner
            </h2>
            <p>
              <Link href={`/admin/users/${owner.id}`} prefetch={false} className="underline">
                {owner.displayName}
              </Link>
            </p>
            <p>Joined {formatMonthYear(owner.joinedAt)}</p>
            <p>Status: {USER_STATUS_LABELS[owner.status]}</p>
            <p>
              {owner.listingCount} listing{owner.listingCount === 1 ? '' : 's'}
            </p>
          </section>
          <section aria-labelledby="actions-heading" className="space-y-3">
            <h2 id="actions-heading" className="text-lg font-medium">
              Actions
            </h2>
            <ReviewActions
              listingId={listing.id}
              version={view.version}
              reviewStatus={listing.reviewStatus}
              autoHidden={view.autoHidden}
            />
          </section>
        </aside>
      </div>

      <section aria-labelledby="reports-heading" className="space-y-3">
        <h2 id="reports-heading" className="text-lg font-medium">
          Reports
        </h2>
        {view.reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {view.reports.map((report) => (
              <li key={report.id}>
                <Link href={`/admin/reports/${report.id}`} prefetch={false} className="underline">
                  {REPORT_REASON_LABELS[report.reason]}
                </Link>{' '}
                · <LocalTime iso={report.createdAt.toISOString()} /> ·{' '}
                {report.reporterName ?? 'Deleted user'} · {REPORT_STATUS_LABELS[report.status]}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history-heading" className="space-y-3">
        <h2 id="history-heading" className="text-lg font-medium">
          History
        </h2>
        <ul className="space-y-1 text-sm">
          <li>
            <LocalTime iso={listing.createdAt.toISOString()} /> · Created
          </li>
          {view.history.map((entry) => (
            <li key={entry.id}>
              <LocalTime iso={entry.createdAt.toISOString()} /> · {ACTION_LABELS[entry.action]} by{' '}
              {entry.adminName ?? 'System'}
              {entry.snapshot ? ` (${summarizeSnapshot(entry.snapshot)})` : ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
