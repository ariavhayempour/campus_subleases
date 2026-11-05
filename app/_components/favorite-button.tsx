'use client';

import { SignInButton } from '@clerk/nextjs';
import { Heart } from 'lucide-react';
import { useState, useTransition } from 'react';
import { setFavoriteAction } from '@/app/me/favorites/actions';
import { cn } from '@/lib/utils';

type FavoriteButtonProps = {
  listingId: string;
  listingTitle: string;
  initialFavorited: boolean;
  signedIn: boolean;
  withText?: boolean;
  className?: string;
};

const baseClass =
  'inline-flex h-9 items-center justify-center gap-2 rounded-full bg-background/90 text-sm shadow-sm ring-1 ring-border transition-colors hover:bg-background focus-visible:outline-2 disabled:opacity-60';

export function FavoriteButton({
  listingId,
  listingTitle,
  initialFavorited,
  signedIn,
  withText = false,
  className,
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const buttonClass = cn(baseClass, withText ? 'px-4' : 'w-9');
  const icon = (
    <Heart aria-hidden className={cn('size-4', favorited && 'fill-rose-500 text-rose-500')} />
  );
  const label = favorited ? `Remove “${listingTitle}” from saved` : `Save “${listingTitle}”`;
  const text = withText && <span>{favorited ? 'Saved' : 'Save'}</span>;

  if (!signedIn) {
    return (
      <SignInButton mode="redirect">
        <button type="button" aria-label={label} className={cn(buttonClass, className)}>
          {icon}
          {text}
        </button>
      </SignInButton>
    );
  }

  function toggle() {
    const next = !favorited;
    setFavorited(next);
    setFailed(false);
    startTransition(async () => {
      const result = await setFavoriteAction(listingId, next).catch(() => null);
      if (!result?.ok) {
        setFavorited(!next);
        setFailed(true);
      }
    });
  }

  return (
    <span
      className={cn(
        withText ? 'inline-flex flex-col items-start gap-1' : 'relative inline-flex',
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={label}
        className={buttonClass}
      >
        {icon}
        {text}
      </button>
      {failed && (
        <span
          role="alert"
          className={cn(
            'text-xs text-destructive',
            !withText &&
              'absolute right-0 top-full z-10 mt-1 w-44 rounded-md bg-background px-2 py-1 shadow-sm ring-1 ring-border',
          )}
        >
          Could not update your saved listings. Try again.
        </span>
      )}
    </span>
  );
}
