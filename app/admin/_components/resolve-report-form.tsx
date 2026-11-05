'use client';

import { useState, useTransition, type FormEvent } from 'react';
import type { ActionResult } from '@/app/_lib/action-result';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { resolveReportAction } from '../reports/actions';

type Failure = Extract<ActionResult<void>, { ok: false }>['error'];

export function ResolveReportForm({ reportId }: { reportId: string }) {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<Failure | null>(null);
  const [note, setNote] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await resolveReportAction({ reportId, note });
      if (result.ok) {
        setFailure(null);
      } else {
        setFailure(result.error);
      }
    });
  }

  const noteError = failure?.fieldErrors?.note?.[0];

  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor="resolution-note">Resolution note</Label>
      <textarea
        id="resolution-note"
        rows={3}
        required
        value={note}
        disabled={pending}
        onChange={(event) => setNote(event.target.value)}
        aria-invalid={noteError ? true : undefined}
        aria-describedby={noteError ? 'resolution-note-error' : undefined}
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm"
      />
      {noteError && (
        <p id="resolution-note-error" className="text-sm text-destructive">
          {noteError}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        Resolve
      </Button>
      {failure && !failure.fieldErrors && (
        <p role="alert" className="text-sm text-destructive">
          {failure.message}
        </p>
      )}
    </form>
  );
}
