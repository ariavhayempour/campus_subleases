import { SignInButton } from '@clerk/nextjs';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

type MessageHostButtonProps = {
  listingId: string;
  conversationId: string | null;
  signedIn: boolean;
};

export function MessageHostButton({ listingId, conversationId, signedIn }: MessageHostButtonProps) {
  if (!signedIn) {
    return (
      <SignInButton mode="redirect">
        <button type="button" className={buttonVariants({ size: 'lg' })}>
          Message host
        </button>
      </SignInButton>
    );
  }
  return (
    <Link
      href={conversationId ? `/messages/${conversationId}` : `/messages/new?listing=${listingId}`}
      className={buttonVariants({ size: 'lg' })}
    >
      {conversationId ? 'View conversation' : 'Message host'}
    </Link>
  );
}
