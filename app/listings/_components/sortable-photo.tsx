'use client';

import { useSortable } from '@dnd-kit/sortable';
import Image from 'next/image';
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
        'relative overflow-hidden rounded-lg border bg-background',
        isDragging && 'z-10 shadow-lg',
      )}
    >
      <button
        type="button"
        className="relative block aspect-[4/3] w-full cursor-grab touch-none bg-muted"
        aria-label={`Photo ${index + 1}. Drag to reorder.`}
        {...attributes}
        {...listeners}
      >
        <Image
          src={item.previewUrl}
          alt=""
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          className="object-cover"
        />
      </button>
      <div className="flex items-center justify-between gap-2 p-2 text-xs">
        <span>
          {index === 0 ? 'Cover' : `Photo ${index + 1}`}
          {item.state === 'uploading' && ' · Uploading…'}
          {item.state === 'failed' && ' · Upload failed'}
        </span>
        <button type="button" className="underline" onClick={() => onRemove(item.key)}>
          Remove
        </button>
      </div>
    </li>
  );
}
