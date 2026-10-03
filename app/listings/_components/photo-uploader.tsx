'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useEffect, useRef, useState } from 'react';
import { requestPhotoUploadsAction } from '@/app/listings/actions';
import { Button } from '@/components/ui/button';
import {
  isPhotoContentType,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  type PhotoContentType,
} from '@/lib/listing-options';
import type { PhotoRef } from '@/lib/validation/listing';
import { SortablePhoto, type PhotoItem } from './sortable-photo';

export type InitialPhoto = { id: string; thumbUrl: string };

type PhotoUploaderProps = {
  initialPhotos: InitialPhoto[];
  onChange: (photos: PhotoRef[]) => void;
  onBusyChange: (busy: boolean) => void;
  invalid?: boolean;
};

const refsOf = (items: PhotoItem[]): PhotoRef[] =>
  items.flatMap((item) => (item.state === 'ready' && item.ref ? [item.ref] : []));

function problemWith(file: File): string | null {
  if (/\.hei[cf]$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif') {
    return 'HEIC photos aren’t supported. Export them as JPEG and try again.';
  }
  if (!isPhotoContentType(file.type)) return 'Use JPEG, PNG, or WebP photos.';
  if (file.size > MAX_PHOTO_BYTES) return 'Each photo must be 10 MB or smaller.';
  return null;
}

export function PhotoUploader({
  initialPhotos,
  onChange,
  onBusyChange,
  invalid,
}: PhotoUploaderProps) {
  const [items, setItems] = useState<PhotoItem[]>(() =>
    initialPhotos.map((photo) => ({
      key: photo.id,
      previewUrl: photo.thumbUrl,
      state: 'ready',
      ref: { kind: 'existing', id: photo.id },
    })),
  );
  const itemsRef = useRef(items);
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Revokes any remaining blob previews when the form unmounts.
  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  // Keeps local state and the form value in step, including updates from finished uploads.
  function update(change: (previous: PhotoItem[]) => PhotoItem[]) {
    const next = change(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
    onChange(refsOf(next));
    onBusyChange(next.some((item) => item.state === 'uploading'));
  }

  async function addFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (inputRef.current) inputRef.current.value = '';
    if (files.length === 0) return;
    setMessage(null);

    const room = MAX_PHOTOS - itemsRef.current.length;
    if (files.length > room) {
      setMessage(
        room === 0
          ? `You already have ${MAX_PHOTOS} photos.`
          : `You can add ${room} more photo${room === 1 ? '' : 's'}.`,
      );
      return;
    }
    const problem = files.map(problemWith).find((text) => text !== null);
    if (problem) {
      setMessage(problem);
      return;
    }

    setRequesting(true);
    onBusyChange(true);
    let result: Awaited<ReturnType<typeof requestPhotoUploadsAction>>;
    try {
      result = await requestPhotoUploadsAction({
        files: files.map((file) => ({
          contentType: file.type as PhotoContentType,
          size: file.size,
        })),
      });
    } catch {
      setMessage('Couldn’t start the upload. Check your connection and try again.');
      return;
    } finally {
      setRequesting(false);
      onBusyChange(itemsRef.current.some((item) => item.state === 'uploading'));
    }
    if (!result.ok) {
      setMessage(result.error.fieldErrors?.files?.[0] ?? result.error.message);
      return;
    }
    const uploads = result.data.map((target, index) => ({ target, file: files[index] }));
    update((previous) => [
      ...previous,
      ...uploads.map(({ target, file }) => ({
        key: target.path,
        previewUrl: URL.createObjectURL(file),
        state: 'uploading' as const,
        ref: null,
      })),
    ]);
    await Promise.all(
      uploads.map(async ({ target, file }) => {
        const ok = await fetch(target.signedUrl, {
          method: 'PUT',
          headers: { 'content-type': file.type },
          body: file,
        }).then(
          (response) => response.ok,
          () => false,
        );
        update((previous) =>
          previous.map((item) =>
            item.key === target.path
              ? {
                  ...item,
                  state: ok ? 'ready' : 'failed',
                  ref: ok ? { kind: 'upload', path: target.path } : null,
                }
              : item,
          ),
        );
      }),
    );
  }

  function remove(key: string) {
    const item = itemsRef.current.find((candidate) => candidate.key === key);
    if (item?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
    update((previous) => previous.filter((candidate) => candidate.key !== key));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    update((previous) =>
      arrayMove(
        previous,
        previous.findIndex((item) => item.key === active.id),
        previous.findIndex((item) => item.key === over.id),
      ),
    );
  }

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((item) => item.key)} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item, index) => (
              <SortablePhoto key={item.key} item={item} index={index} onRemove={remove} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <input
        ref={inputRef}
        id="photos"
        aria-describedby="photos-error"
        aria-invalid={invalid}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(event) => void addFiles(event.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        aria-describedby="photos-error"
        aria-invalid={invalid}
        onClick={() => inputRef.current?.click()}
        disabled={requesting || items.length >= MAX_PHOTOS}
      >
        Add photos
      </Button>
      <p className="text-sm text-muted-foreground">
        Up to {MAX_PHOTOS} JPEG, PNG, or WebP photos, 10 MB each. Drag to reorder; the first photo
        is the cover.
      </p>
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
