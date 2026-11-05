import { LocalTime } from '@/app/_components/local-time';
import { DELETED_USER_LABEL, type MessageView } from '@/lib/messaging-options';
import { cn } from '@/lib/utils';

type MessageListProps = { messages: MessageView[]; viewerId: string };

export function MessageList({ messages, viewerId }: MessageListProps) {
  return (
    <ol className="space-y-3">
      {messages.map((message) => {
        const mine = message.senderId === viewerId;
        return (
          <li key={message.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
            {message.senderId === null && (
              <span className="mb-0.5 text-xs text-muted-foreground">{DELETED_USER_LABEL}</span>
            )}
            <div
              className={cn(
                'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm',
                mine ? 'bg-primary text-primary-foreground' : 'bg-muted',
              )}
            >
              {message.body}
            </div>
            <LocalTime iso={message.createdAt} className="mt-0.5 text-xs text-muted-foreground" />
          </li>
        );
      })}
    </ol>
  );
}
