'use client';

import { useState } from 'react';
import { LocalTime } from '@/app/_components/local-time';
import { ReportDialog } from '@/app/_components/report-dialog';
import { DELETED_USER_LABEL, type MessageView } from '@/lib/messaging-options';
import { cn } from '@/lib/utils';

type MessageListProps = { messages: MessageView[]; viewerId: string };

export function MessageList({ messages, viewerId }: MessageListProps) {
  const [reportId, setReportId] = useState<string | null>(null);
  return (
    <>
      <ol className="space-y-3">
        {messages.map((message) => {
          const mine = message.senderId === viewerId;
          return (
            <li
              key={message.id}
              className={cn('group flex flex-col', mine ? 'items-end' : 'items-start')}
            >
              {message.senderId === null && (
                <span className="mb-0.5 text-xs text-muted-foreground">{DELETED_USER_LABEL}</span>
              )}
              <div className="flex max-w-[85%] items-center gap-1">
                <div
                  id={`message-${message.id}`}
                  className={cn(
                    'min-w-0 whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm',
                    mine ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
                  {message.body}
                </div>
                {!mine && message.senderId !== null && (
                  <button
                    type="button"
                    onClick={() => setReportId(message.id)}
                    aria-describedby={`message-${message.id}`}
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground opacity-0 hover:bg-muted focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100 pointer-coarse:opacity-100"
                  >
                    Report message
                  </button>
                )}
              </div>
              <LocalTime iso={message.createdAt} className="mt-0.5 text-xs text-muted-foreground" />
            </li>
          );
        })}
      </ol>
      <ReportDialog
        open={reportId !== null}
        onClose={() => setReportId(null)}
        targetType="message"
        targetId={reportId ?? ''}
        title="Report message"
      />
    </>
  );
}
