import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ListingBadge, Tag } from '@/app/_components/listing-badge';
import { LocalTime } from '@/app/_components/local-time';
import { TermTimelineBar } from '@/app/_components/term-timeline';
import { orAdminNotFound } from '@/app/_lib/guards';
import { ACTION_LABELS, summarizeSnapshot } from '@/lib/audit-labels';
import { formatMonthYear } from '@/lib/format';
import {
  AMENITY_LABELS,
  GENDER_PREFERENCE_LABELS,
  LISTING_TYPE_LABELS,
} from '@/lib/listing-options';
import { listingBadges } from '@/lib/listing-rules';
import {
  auditActorLabel,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  USER_STATUS_LABELS,
} from '@/lib/moderation-options';
import { getActor } from '@/server/auth/get-actor';
import { getAdminListing } from '@/server/services/admin-listings';
import {
  AdminPageHeader,
  AdminSection,
  Dot,
  Empty,
  LINK,
  Row,
  RowList,
} from '../../_components/admin-ui';
import { ReviewActions } from '../../_components/review-actions';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export const metadata: Metadata = { title: 'Admin · Listing' };

type AdminListingPageProps = { params: Promise<{ id: string }> };

export default async function AdminListingPage({ params }: AdminListingPageProps) {
  const { id } = await params;
  const view = await orAdminNotFound(getAdminListing(await getActor(), id));
  const { detail: listing, owner } = view;

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

  const [cover, ...rest] = listing.photos;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={listing.title}
        back={{ href: '/admin/listings', label: 'Back to listings' }}
      >
        <div className="flex flex-wrap items-center gap-2">
          {listingBadges(listing).map((badge) => (
            <ListingBadge key={badge.label} badge={badge} />
          ))}
          {view.autoHidden && <Tag className="bg-bad-bg text-bad">Auto-hidden</Tag>}
          {view.farFromCampusKm !== null && (
            <Tag className="bg-warn-bg text-warn">
              Far from campus: {view.farFromCampusKm.toFixed(1)} km
            </Tag>
          )}
        </div>
      </AdminPageHeader>

      <div className="grid grid-cols-[minmax(0,1fr)_22rem] gap-10">
        <section aria-labelledby="preview-heading" className="min-w-0 space-y-6">
          <h2 id="preview-heading" className="sr-only">
            Preview
          </h2>
          {cover && (
            <div className="grid grid-cols-4 gap-2">
              <div className="relative col-span-2 row-span-2 aspect-[4/3] overflow-hidden rounded-md bg-surface-2">
                <Image src={cover.thumbUrl} alt="" fill sizes="480px" className="object-cover" />
              </div>
              {rest.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-2"
                >
                  <Image src={photo.thumbUrl} alt="" fill sizes="240px" className="object-cover" />
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1">
            <p className="flex items-baseline gap-1.5">
              <span className="numeral text-[2.75rem]">{usd.format(listing.rentCents / 100)}</span>
              <span className="text-sm font-medium text-ink-2">/ month</span>
            </p>
            <p className="text-sm text-ink-2">
              {listing.address}
              {listing.unit ? `, Unit ${listing.unit}` : ''}, {listing.city}, {listing.state}{' '}
              {listing.zip} · {listing.school.name}
            </p>
          </div>
          <TermTimelineBar from={listing.availableFrom} to={listing.availableTo} size="full" />
          <ul className="flex flex-wrap gap-1.5">
            {facts.map((fact) => (
              <li key={fact}>
                <Tag className="bg-surface-2 text-ink ring-1 ring-line-2 ring-inset">{fact}</Tag>
              </li>
            ))}
          </ul>
          <p className="max-w-[70ch] text-[15px] leading-relaxed whitespace-pre-line text-ink">
            {listing.description}
          </p>
          {listing.amenities.length > 0 && (
            <p className="text-sm text-ink-2">
              <span className="font-semibold text-ink">Amenities:</span>{' '}
              {listing.amenities.map((amenity) => AMENITY_LABELS[amenity]).join(', ')}
            </p>
          )}
          {listing.reviewNote && (
            <p className="rounded-md bg-bad-bg px-4 py-3 text-sm text-bad">
              Review note: {listing.reviewNote}
            </p>
          )}
        </section>

        <aside className="sticky top-6 space-y-6 self-start">
          <section
            aria-labelledby="actions-heading"
            className="space-y-4 rounded-md border border-line-2 p-5 shadow-[0_6px_24px_rgb(21_23_28/0.07)]"
          >
            <h2 id="actions-heading" className="varsity text-[1.375rem] font-extrabold">
              Actions
            </h2>
            <ReviewActions
              listingId={listing.id}
              version={view.version}
              reviewStatus={listing.reviewStatus}
              autoHidden={view.autoHidden}
            />
          </section>
          <section aria-labelledby="owner-heading" className="space-y-1.5 text-sm">
            <h2 id="owner-heading" className="varsity text-[1.375rem] font-extrabold">
              Owner
            </h2>
            <p>
              <Link href={`/admin/users/${owner.id}`} prefetch={false} className={LINK}>
                {owner.displayName}
              </Link>
            </p>
            <p className="text-ink-2">
              Joined {formatMonthYear(owner.joinedAt)} · {USER_STATUS_LABELS[owner.status]} ·{' '}
              {owner.listingCount} listing{owner.listingCount === 1 ? '' : 's'}
            </p>
          </section>
        </aside>
      </div>

      <AdminSection id="reports" title="Reports">
        {view.reports.length === 0 ? (
          <Empty />
        ) : (
          <RowList>
            {view.reports.map((report) => (
              <Row key={report.id}>
                <Link href={`/admin/reports/${report.id}`} prefetch={false} className={LINK}>
                  {REPORT_REASON_LABELS[report.reason]}
                </Link>
                <Dot />
                <LocalTime iso={report.createdAt.toISOString()} className="text-ink-2" />
                <Dot />
                <span>{report.reporterName ?? 'Deleted user'}</span>
                <Dot />
                <span className="text-ink-2">{REPORT_STATUS_LABELS[report.status]}</span>
              </Row>
            ))}
          </RowList>
        )}
      </AdminSection>

      <AdminSection id="history" title="History">
        <RowList>
          <Row>
            <LocalTime iso={listing.createdAt.toISOString()} className="text-ink-2" />
            <Dot />
            <span>Created</span>
          </Row>
          {view.history.map((entry) => (
            <Row key={entry.id}>
              <LocalTime iso={entry.createdAt.toISOString()} className="text-ink-2" />
              <Dot />
              <span>
                <span className="font-semibold">{ACTION_LABELS[entry.action]}</span> by{' '}
                {auditActorLabel(entry)}
                {entry.snapshot ? ` (${summarizeSnapshot(entry.snapshot)})` : ''}
              </span>
            </Row>
          ))}
        </RowList>
      </AdminSection>
    </div>
  );
}
