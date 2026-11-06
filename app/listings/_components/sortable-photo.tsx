'use client';

import { useSortable } from '@dnd-kit/sortable';
import { GripVertical, X } from 'lucide-react';
import Image from 'next/image';
import { Tag } from '@/app/_components/listing-badge';
import type { PhotoRef } from '@/lib/validation/listing';
import { cn } from '@/lib/utils';

export type PhotoItem = {
  key: string;
  previewUrl: string;
  state: 'ready' | 'uploading' | 'failed';
  ref: PhotoRef | null;
};

type SortablePhotoProps = { item: PhotoItem; index: number; onRemove: (key: string) => void };

export function SortablePhoto({ item, index, onRemove }: SortablePhotoProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
      }}
      className={cn(
        'relative overflow-hidden rounded-md bg-background ring-1 ring-line',
        isDragging && 'z-10 shadow-[0_12px_28px_rgb(21_23_28/0.22)]',
        item.state === 'failed' && 'ring-2 ring-bad',
      )}
    >
      <button
        type="button"
        className="relative block aspect-[4/3] w-full cursor-grab touch-none bg-surface-2 active:cursor-grabbing"
        aria-label={`Photo ${index + 1}. Drag to reorder.`}
        {...attributes}
        {...listeners}
      >
        <Image
          src={item.previewUrl}
          alt=""
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          className={cn('object-cover', item.state === 'uploading' && 'opacity-60')}
        />
        {index === 0 && (
          <Tag className="absolute top-2 left-2 bg-highlight text-on-highlight">Cover</Tag>
        )}
        <GripVertical
          aria-hidden="true"
          className="absolute right-2 bottom-2 size-6 rounded bg-white/90 p-0.5 text-ink"
        />
      </button>
      <div className="flex items-center justify-between gap-2 px-2.5 py-2 text-xs text-ink-2">
        <span className={cn(item.state === 'failed' && 'font-semibold text-bad')}>
          {`Photo ${index + 1}`}
          {item.state === 'uploading' && ' · Uploading…'}
          {item.state === 'failed' && ' · Upload failed'}
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1 font-semibold text-ink hover:text-bad"
          onClick={() => onRemove(item.key)}
        >
          <X aria-hidden="true" className="size-3.5" />
          Remove
        </button>
      </div>
    </li>
  );
}
