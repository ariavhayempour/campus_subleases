import Link from 'next/link';
import { DELETED_USER_LABEL, REMOVED_LISTING_LABEL } from '@/lib/messaging-options';
import type { Participant, ThreadListing } from '@/server/services/messaging-reads';
import { ThreadMenu } from './thread-menu';

type ThreadHeaderProps = {
  listing: ThreadListing | null;
  otherUser: Participant | null;
  blocked?: boolean;
  showMenu?: boolean;
};

export function ThreadHeader({
  listing,
  otherUser,
  blocked = false,
  showMenu = true,
}: ThreadHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
      <div className="min-w-0 text-sm">
        <h1 className="truncate font-semibold">
          {listing === null ? (
            REMOVED_LISTING_LABEL
          ) : listing.linkable ? (
            <Link
              href={`/${listing.schoolSlug}/listings/${listing.id}`}
              className="hover:underline"
            >
              {listing.title}
            </Link>
          ) : (
            listing.title
          )}
        </h1>
        {listing && (
          <p className="truncate text-muted-foreground">
            {listing.unit ? `${listing.address}, Unit ${listing.unit}` : listing.address}
          </p>
        )}
        <p className="truncate">{otherUser?.displayName ?? DELETED_USER_LABEL}</p>
      </div>
      {otherUser && showMenu && (
        <ThreadMenu
          otherUserId={otherUser.id}
          otherName={otherUser.displayName}
          blocked={blocked}
        />
      )}
    </header>
  );
}
