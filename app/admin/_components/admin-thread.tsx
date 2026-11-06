import Link from 'next/link';
import { LocalTime } from '@/app/_components/local-time';
import { cn } from '@/lib/utils';
import type { AdminConversationView } from '@/server/services/admin-conversations';
import { Empty, LINK } from './admin-ui';

type AdminThreadProps = { conversation: AdminConversationView; highlightMessageId?: string };

function Person({ person }: { person: AdminConversationView['host'] }) {
  if (!person) return <span>Deleted user</span>;
  return (
    <Link href={`/admin/users/${person.id}`} prefetch={false} className={LINK}>
      {person.displayName}
    </Link>
  );
}

// Same bubble language as the student inbox: the renter on the right, the host on the left.
export function AdminThread({ conversation, highlightMessageId }: AdminThreadProps) {
  const { listing, host, renter, messages, truncated } = conversation;
  const names = new Map<string, string>();
  if (host) names.set(host.id, host.displayName);
  if (renter) names.set(renter.id, renter.displayName);

  return (
    <div className="overflow-hidden rounded-md border border-line">
      <header className="space-y-1 border-b border-line bg-surface-2 px-5 py-3.5 text-sm">
        <p className="text-[15px] font-semibold">
          {listing ? (
            <Link href={`/admin/listings/${listing.id}`} className={LINK}>
              {listing.title}
            </Link>
          ) : (
            'Listing removed'
          )}
        </p>
        {listing && (
          <p className="text-ink-2">
            {listing.unit ? `Unit ${listing.unit}, ` : ''}
            {listing.address}
          </p>
        )}
        <p className="text-ink-2">
          Host: <Person person={host} /> · Renter: <Person person={renter} />
        </p>
      </header>
      <div className="space-y-4 px-5 py-6">
        {truncated && <p className="text-sm text-ink-2">Showing the latest 1,000 messages</p>}
        {messages.length === 0 ? (
          <Empty>No messages.</Empty>
        ) : (
          <ol className="space-y-3.5">
            {messages.map((message) => {
              const highlighted = message.id === highlightMessageId;
              const fromRenter = renter !== null && message.senderId === renter.id;
              return (
                <li
                  key={message.id}
                  aria-current={highlighted ? 'true' : undefined}
                  className={cn('flex flex-col', fromRenter ? 'items-end' : 'items-start')}
                >
                  <p className="mb-1 text-xs text-ink-3">
                    {(message.senderId && names.get(message.senderId)) || 'Deleted user'} ·{' '}
                    <LocalTime iso={message.createdAt} />
                  </p>
                  <p
                    className={cn(
                      'max-w-[68%] min-w-0 px-3.5 py-2.5 text-[15px] break-words whitespace-pre-wrap',
                      fromRenter
                        ? 'rounded-[14px_14px_3px_14px] bg-ink text-white'
                        : 'rounded-[14px_14px_14px_3px] bg-surface-2 text-ink',
                      highlighted && 'ring-3 ring-warn ring-offset-2',
                    )}
                  >
                    {message.body}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
