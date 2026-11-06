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
      <ol className="space-y-3.5">
        {messages.map((message) => {
          const mine = message.senderId === viewerId;
          return (
            <li
              key={message.id}
              className={cn('group flex flex-col', mine ? 'items-end' : 'items-start')}
            >
              {message.senderId === null && (
                <span className="mb-1 text-xs text-ink-3">{DELETED_USER_LABEL}</span>
              )}
              <div className="flex max-w-[85%] items-center gap-1 md:max-w-[68%]">
                <div
                  id={`message-${message.id}`}
                  className={cn(
                    'min-w-0 px-3.5 py-2.5 text-[15px] break-words whitespace-pre-wrap',
                    mine
                      ? 'rounded-[14px_14px_3px_14px] bg-school text-on-school'
                      : 'rounded-[14px_14px_14px_3px] bg-surface-2 text-ink',
                  )}
                >
                  {message.body}
                </div>
                {!mine && message.senderId !== null && (
                  <button
                    type="button"
                    onClick={() => setReportId(message.id)}
                    aria-describedby={`message-${message.id}`}
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs text-ink-2 opacity-0 hover:bg-surface-2 focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100 pointer-coarse:opacity-100"
                  >
                    Report message
                  </button>
                )}
              </div>
              <LocalTime iso={message.createdAt} className="mt-1 text-xs text-ink-3" />
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
