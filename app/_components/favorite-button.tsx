'use client';

import { SignInButton } from '@clerk/nextjs';
import { Heart } from 'lucide-react';
import { useState, useTransition } from 'react';
import { setFavoriteAction } from '@/app/me/favorites/actions';
import { cn } from '@/lib/utils';

type FavoriteButtonProps = {
  listingId: string;
  initialFavorited: boolean;
  signedIn: boolean;
  withText?: boolean;
  className?: string;
};

const baseClass =
  'inline-flex h-9 items-center justify-center gap-2 rounded-full bg-background/90 text-sm shadow-sm ring-1 ring-border transition-colors hover:bg-background focus-visible:outline-2 disabled:opacity-60';

export function FavoriteButton({
  listingId,
  initialFavorited,
  signedIn,
  withText = false,
  className,
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const classes = cn(baseClass, withText ? 'px-4' : 'w-9', className);
  const icon = (
    <Heart aria-hidden className={cn('size-4', favorited && 'fill-rose-500 text-rose-500')} />
  );
  const label = withText ? undefined : 'Save listing';
  const text = withText && <span>{favorited ? 'Saved' : 'Save'}</span>;

  if (!signedIn) {
    return (
      <SignInButton mode="redirect">
        <button type="button" aria-label={label} className={classes}>
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
      const result = await setFavoriteAction(listingId, next);
      if (!result.ok) {
        setFavorited(!next);
        setFailed(true);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={favorited}
        aria-label={label}
        className={classes}
      >
        {icon}
        {text}
      </button>
      {failed && (
        <span role="alert" className="sr-only">
          Could not update your saved listings. Try again.
        </span>
      )}
    </>
  );
}
