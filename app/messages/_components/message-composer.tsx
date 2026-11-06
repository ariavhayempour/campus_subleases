'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { SendHorizontal } from 'lucide-react';
import type { ActionResult } from '@/app/_lib/action-result';
import { MESSAGE_MAX_LENGTH } from '@/lib/messaging-options';

type MessageComposerProps<T> = {
  onSubmit: (body: string) => Promise<ActionResult<T>>;
  onSent: (data: T) => void;
};

export function MessageComposer<T>({ onSubmit, onSent }: MessageComposerProps<T>) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const refocus = useRef(false);

  // A disabled textarea drops focus, so restore it once it is enabled again.
  useEffect(() => {
    if (!pending && refocus.current) {
      refocus.current = false;
      textareaRef.current?.focus();
    }
  }, [pending]);

  function submit() {
    if (pending) return;
    setError(null);
    refocus.current = true;
    startTransition(async () => {
      try {
        const result = await onSubmit(body);
        if (result.ok) {
          setBody('');
          onSent(result.data);
        } else {
          setError(result.error.fieldErrors?.body?.[0] ?? result.error.message);
        }
      } catch {
        setError('Could not send your message. Try again.');
      }
    });
  }

  return (
    <form
      className="border-t border-line px-5 pt-3.5 pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {error && (
        <p role="alert" className="mb-2 text-sm text-bad">
          {error}
        </p>
      )}
      <div className="flex items-end gap-2.5">
        <label htmlFor="message-body" className="sr-only">
          Message
        </label>
        <textarea
          id="message-body"
          ref={textareaRef}
          value={body}
          rows={2}
          maxLength={MESSAGE_MAX_LENGTH}
          disabled={pending}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Write a message"
          className="max-h-40 min-h-12 flex-1 resize-none rounded-md border border-line-2 bg-background px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-school focus-visible:ring-3 focus-visible:ring-school/20 focus-visible:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 items-center gap-2 rounded-md bg-school px-5 text-sm font-semibold text-on-school transition-colors hover:bg-school-deep disabled:opacity-60"
        >
          <SendHorizontal aria-hidden="true" className="size-4" />
          Send
        </button>
      </div>
    </form>
  );
}
