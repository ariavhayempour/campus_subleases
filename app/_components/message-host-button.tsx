import { SignUpButton } from '@clerk/nextjs';
import { MessageSquare } from 'lucide-react';
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
      <SignUpButton mode="redirect">
        <button type="button" className={buttonVariants({ size: 'lg' })}>
          <MessageSquare aria-hidden="true" />
          Message host
        </button>
      </SignUpButton>
    );
  }
  return (
    <Link
      href={conversationId ? `/messages/${conversationId}` : `/messages/new?listing=${listingId}`}
      className={buttonVariants({ size: 'lg' })}
    >
      <MessageSquare aria-hidden="true" />
      {conversationId ? 'View conversation' : 'Message host'}
    </Link>
  );
}
