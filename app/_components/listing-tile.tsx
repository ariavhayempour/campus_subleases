import Image from 'next/image';
import Link from 'next/link';
import { FavoriteButton } from '@/app/_components/favorite-button';
import { formatDateRange, formatDistanceKm, formatRent } from '@/lib/format';
import { LISTING_TYPE_LABELS } from '@/lib/listing-options';
import type { ListingCard } from '@/server/services/listing-cards';

type ListingTileProps = {
  card: ListingCard;
  signedIn: boolean;
  onHover?: (id: string | null) => void;
};

export function ListingTile({ card, signedIn, onHover }: ListingTileProps) {
  const rooms = card.bedrooms === 0 ? 'Studio' : `${card.bedrooms} bed`;
  return (
    <article
      className="group relative"
      onMouseEnter={onHover && (() => onHover(card.id))}
      onMouseLeave={onHover && (() => onHover(null))}
    >
      <Link
        href={`/${card.schoolSlug}/listings/${card.id}`}
        className="block rounded-xl focus-visible:outline-2"
        onFocus={onHover && (() => onHover(card.id))}
        onBlur={onHover && (() => onHover(null))}
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
          {card.coverThumbUrl && (
            <Image
              src={card.coverThumbUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 100vw"
              className="object-cover"
            />
          )}
        </div>
        <div className="mt-2 space-y-0.5">
          <p className="font-semibold">{formatRent(card.rentCents)}</p>
          <h2 className="truncate font-medium group-hover:underline">{card.title}</h2>
          <p className="text-sm text-muted-foreground">
            {LISTING_TYPE_LABELS[card.type]} · {rooms} · {card.bathrooms} bath
          </p>
          <p className="text-sm text-muted-foreground">
            {formatDateRange(card.availableFrom, card.availableTo)} ·{' '}
            {formatDistanceKm(card.distanceKm)} to campus
          </p>
        </div>
      </Link>
      <FavoriteButton
        listingId={card.id}
        listingTitle={card.title}
        initialFavorited={card.isFavorited}
        signedIn={signedIn}
        className="absolute right-2 top-2"
      />
    </article>
  );
}
