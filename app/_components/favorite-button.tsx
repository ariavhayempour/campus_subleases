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
  'inline-flex items-center justify-center gap-2 border border-line-2 text-sm font-semibold text-ink transition-colors disabled:opacity-60';
const iconClass =
  'size-9 rounded-full bg-white/95 shadow-[0_1px_4px_rgb(0_0_0/0.18)] hover:bg-white';
// The labeled variant matches the outline button it sits beside on the listing page.
const textClass =
  'h-12 w-full rounded-md bg-background px-5 text-[15px] hover:border-ink-3 hover:bg-surface-2';

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
  const buttonClass = cn(baseClass, withText ? textClass : iconClass);
  const icon = <Heart aria-hidden className={cn('size-4', favorited && 'fill-bad text-bad')} />;
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
        withText ? 'flex flex-col items-stretch gap-1' : 'relative inline-flex',
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
