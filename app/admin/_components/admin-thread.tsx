import Link from 'next/link';
import { LocalTime } from '@/app/_components/local-time';
import { cn } from '@/lib/utils';
import type { AdminConversationView } from '@/server/services/admin-conversations';

type AdminThreadProps = { conversation: AdminConversationView; highlightMessageId?: string };

function Person({ person }: { person: AdminConversationView['host'] }) {
  if (!person) return <span>Deleted user</span>;
  return (
    <Link href={`/admin/users/${person.id}`} prefetch={false} className="underline">
      {person.displayName}
    </Link>
  );
}

export function AdminThread({ conversation, highlightMessageId }: AdminThreadProps) {
  const { listing, host, renter, messages, truncated } = conversation;
  const names = new Map<string, string>();
  if (host) names.set(host.id, host.displayName);
  if (renter) names.set(renter.id, renter.displayName);

  return (
    <div className="space-y-4">
      <header className="space-y-1 text-sm">
        <p className="font-medium">
          {listing ? (
            <Link href={`/admin/listings/${listing.id}`} className="underline">
              {listing.title}
            </Link>
          ) : (
            'Listing removed'
          )}
        </p>
        {listing && (
          <p className="text-muted-foreground">
            {listing.unit ? `Unit ${listing.unit}, ` : ''}
            {listing.address}
          </p>
        )}
        <p>
          Host: <Person person={host} /> · Renter: <Person person={renter} />
        </p>
      </header>
      {truncated && (
        <p className="text-sm text-muted-foreground">Showing the latest 1,000 messages</p>
      )}
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">No messages.</p>
      ) : (
        <ol className="space-y-3">
          {messages.map((message) => {
            const highlighted = message.id === highlightMessageId;
            return (
              <li
                key={message.id}
                aria-current={highlighted ? 'true' : undefined}
                className={cn('rounded-lg border p-3 text-sm', highlighted && 'ring-2 ring-ring')}
              >
                <p className="text-xs text-muted-foreground">
                  {(message.senderId && names.get(message.senderId)) || 'Deleted user'} ·{' '}
                  <LocalTime iso={message.createdAt} />
                </p>
                <p className="min-w-0 whitespace-pre-wrap break-words">{message.body}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
