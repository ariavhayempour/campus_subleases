import Image from 'next/image';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { FavoriteButton } from '@/app/_components/favorite-button';
import { Tag } from '@/app/_components/listing-badge';
import { TermTimelineBar } from '@/app/_components/term-timeline';
import { formatDateRange, formatDistanceKm } from '@/lib/format';
import { LISTING_TYPE_LABELS } from '@/lib/listing-options';
import type { ListingCard } from '@/server/services/listing-cards';

type ListingTileProps = {
  card: ListingCard;
  signedIn: boolean;
  campusName?: string;
  timelineStart?: string;
  onHover?: (id: string | null) => void;
};

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const SHORT_TYPE = { apartment: 'Apartment', house: 'House', room: 'Room' } as const;

export function ListingTile({
  card,
  signedIn,
  campusName = 'campus',
  timelineStart,
  onHover,
}: ListingTileProps) {
  const rooms = card.bedrooms === 0 ? 'Studio' : `${card.bedrooms} bed`;
  const facts = [SHORT_TYPE[card.type], rooms, `${card.bathrooms} bath`];
  if (card.furnished) facts.push('Furnished');
  return (
    <article
      className="group relative"
      onMouseEnter={onHover && (() => onHover(card.id))}
      onMouseLeave={onHover && (() => onHover(null))}
    >
      <Link
        href={`/${card.schoolSlug}/listings/${card.id}`}
        className="block rounded-md text-ink no-underline"
        onFocus={onHover && (() => onHover(card.id))}
        onBlur={onHover && (() => onHover(null))}
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-2">
          {card.coverThumbUrl && (
            <Image
              src={card.coverThumbUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 100vw"
              className="object-cover transition-transform duration-500 ease-out-expo group-hover:scale-[1.035]"
            />
          )}
          {card.isNew && (
            <Tag className="absolute top-2.5 left-2.5 bg-highlight text-on-highlight">New</Tag>
          )}
        </div>
        <div className="grid gap-[3px] pt-3">
          <p className="flex items-baseline gap-1">
            <span className="numeral text-[2.375rem]">{usd.format(card.rentCents / 100)}</span>
            <span className="text-[13px] font-medium text-ink-2">/ month</span>
          </p>
          <h2 className="truncate text-[15px] font-semibold group-hover:underline">{card.title}</h2>
          <p className="truncate text-[13px] text-ink-2">
            <span className="sr-only">{LISTING_TYPE_LABELS[card.type]}. </span>
            <span aria-hidden="true">{facts.join(' · ')}</span>
          </p>
          <p className="flex items-center gap-1.5 truncate text-[13px] text-ink-2">
            <MapPin aria-hidden="true" className="size-[15px]" />
            <span>
              <b className="font-semibold text-ink">{formatDistanceKm(card.distanceKm)}</b> to{' '}
              {campusName} · {formatDateRange(card.availableFrom, card.availableTo)}
            </span>
          </p>
          <TermTimelineBar
            from={card.availableFrom}
            to={card.availableTo}
            axisStart={timelineStart}
          />
        </div>
      </Link>
      <FavoriteButton
        listingId={card.id}
        listingTitle={card.title}
        initialFavorited={card.isFavorited}
        signedIn={signedIn}
        className="absolute top-2.5 right-2.5"
      />
    </article>
  );
}
