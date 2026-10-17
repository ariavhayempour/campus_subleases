'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
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
      className="border-t p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {error && (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-end gap-2">
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
          className="max-h-40 min-h-12 flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-2 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-60"
        >
          Send
        </button>
      </div>
    </form>
  );
}
