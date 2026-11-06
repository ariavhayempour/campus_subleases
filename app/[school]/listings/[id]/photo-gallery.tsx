'use client';

import { Grid2x2, X } from 'lucide-react';
import Image from 'next/image';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import type { ListingPhotoView } from '@/server/services/listing-reads';

// Side tiles beside the lead photo, laid out so 1–4 of them always fill the 2×2 area.
const SIDE_LAYOUT: Record<number, string[]> = {
  1: ['col-span-2 row-span-2'],
  2: ['col-span-2', 'col-span-2'],
  3: ['', '', 'col-span-2'],
  4: ['', '', '', ''],
};

export function PhotoGallery({ photos, title }: { photos: ListingPhotoView[]; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  if (photos.length === 0) {
    return <div className="aspect-[16/9] rounded-md bg-surface-2 md:aspect-auto md:h-[28rem]" />;
  }
  const [lead, ...rest] = photos;
  const side = rest.slice(0, 4);

  return (
    <>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 md:hidden">
        {photos.map((photo, index) => (
          <li
            key={photo.id}
            className="relative aspect-[4/3] w-[88%] shrink-0 snap-center overflow-hidden rounded-md bg-surface-2"
          >
            <Image
              src={photo.galleryUrl}
              alt={index === 0 ? title : ''}
              fill
              priority={index === 0}
              sizes="88vw"
              className="object-cover"
            />
            <span className="numeral absolute right-2 bottom-2 rounded-[2px] bg-ink/80 px-1.5 pt-1 pb-0.5 text-sm text-white">
              {index + 1}/{photos.length}
            </span>
          </li>
        ))}
      </ul>

      <div
        className={cn(
          'relative hidden h-[28rem] gap-2 md:grid',
          side.length > 0 ? 'grid-cols-[1.6fr_1fr]' : 'grid-cols-1',
        )}
      >
        <div className="relative overflow-hidden rounded-md bg-surface-2">
          <Image
            src={lead.galleryUrl}
            alt={title}
            fill
            priority
            sizes="(min-width: 1280px) 760px, 60vw"
            className="object-cover"
          />
        </div>
        {side.length > 0 && (
          <div className="grid grid-cols-2 grid-rows-2 gap-2">
            {side.map((photo, index) => (
              <div
                key={photo.id}
                className={cn(
                  'relative overflow-hidden rounded-md bg-surface-2',
                  SIDE_LAYOUT[side.length][index],
                )}
              >
                <Image
                  src={photo.galleryUrl}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 240px, 20vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}
        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => dialog.current?.showModal()}
            className="absolute right-3 bottom-3 inline-flex h-9 items-center gap-2 rounded-md bg-white px-3 text-[13px] font-semibold text-ink shadow-[0_2px_8px_rgb(0_0_0/0.2)] hover:bg-surface-2"
          >
            <Grid2x2 aria-hidden="true" className="size-4" />
            All {photos.length} photos
          </button>
        )}
      </div>

      <dialog
        ref={dialog}
        aria-label={`All photos of ${title}`}
        className="m-auto max-h-[92dvh] w-[min(64rem,calc(100vw-2rem))] rounded-md bg-background p-0 text-ink shadow-[0_20px_60px_rgb(0_0_0/0.35)] backdrop:bg-ink/70"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-background px-5 py-3">
          <p className="varsity text-xl font-extrabold">{photos.length} photos</p>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close photos"
            className="grid size-9 place-items-center rounded-full hover:bg-surface-2"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <ul className="grid gap-3 p-5">
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-2"
            >
              <Image
                src={photo.galleryUrl}
                alt={`Photo ${index + 1} of ${photos.length}`}
                fill
                sizes="(min-width: 1024px) 960px, 100vw"
                className="object-cover"
              />
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
