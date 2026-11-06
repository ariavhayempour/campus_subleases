'use client';

import { useClerk } from '@clerk/nextjs';
import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CONFIRM_WORD } from '@/lib/moderation-options';
import { deleteAccountAction } from '../actions';

export function DeleteAccountForm() {
  const { signOut } = useClerk();
  const [confirm, setConfirm] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    setFieldError(null);
    setFormError(null);
    startTransition(async () => {
      const result = await deleteAccountAction({ confirm }).catch(() => null);
      if (result?.ok) {
        try {
          await signOut({ redirectUrl: '/' });
        } catch {
          window.location.assign(window.location.origin);
        }
        return;
      }
      const message = result?.error.fieldErrors?.confirm?.[0];
      if (message) setFieldError(message);
      else setFormError(result?.error.message ?? 'Something went wrong. Try again.');
    });
  }

  return (
    <form onSubmit={submit} className="max-w-sm space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="delete-confirm">Type {CONFIRM_WORD} to confirm</Label>
        <Input
          id="delete-confirm"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="off"
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? 'delete-confirm-error' : undefined}
        />
        {fieldError && (
          <p id="delete-confirm-error" className="text-sm font-medium text-bad">
            {fieldError}
          </p>
        )}
      </div>
      {formError && (
        <p role="alert" className="text-sm font-medium text-bad">
          {formError}
        </p>
      )}
      <Button
        type="submit"
        variant="destructive"
        className="bg-bad text-white hover:bg-bad/90"
        disabled={pending}
      >
        Delete my account
      </Button>
    </form>
  );
}
