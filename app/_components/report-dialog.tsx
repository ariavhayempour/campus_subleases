'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { FieldError } from '@/app/listings/_components/field-error';
import { reportAction } from '@/app/_lib/report-action';
import { Button } from '@/components/ui/button';
import {
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  REPORT_SENT,
  type ReportTargetType,
} from '@/lib/moderation-options';

type ReportDialogProps = {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  title: string;
};

export function ReportDialog({ open, onClose, targetType, targetId, title }: ReportDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onKeyDown={(event) => {
        if (busy.current && event.key === 'Escape') event.preventDefault();
      }}
      onCancel={(event) => {
        if (busy.current) event.preventDefault();
      }}
      aria-labelledby="report-dialog-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-md bg-background p-6 text-ink shadow-[0_20px_60px_rgb(0_0_0/0.3)] ring-1 ring-line backdrop:bg-ink/60"
    >
      {open && (
        <ReportForm
          title={title}
          targetType={targetType}
          targetId={targetId}
          onClose={onClose}
          onBusy={(value) => (busy.current = value)}
        />
      )}
    </dialog>
  );
}

type ReportFormProps = Pick<ReportDialogProps, 'onClose' | 'targetType' | 'targetId' | 'title'> & {
  onBusy: (busy: boolean) => void;
};

// Mounted only while open, so every opening starts from a blank form.
function ReportForm({ title, targetType, targetId, onClose, onBusy }: ReportFormProps) {
  const id = useId();
  const firstRadio = useRef<HTMLInputElement>(null);
  const detailsField = useRef<HTMLTextAreaElement>(null);
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');

  // Keyboard and screen-reader users land on the field that failed.
  useEffect(() => {
    if (fieldErrors.reason) firstRadio.current?.focus();
    else if (fieldErrors.details) detailsField.current?.focus();
  }, [fieldErrors]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    onBusy(true); // a ref, so Esc is blocked before any re-render
    startTransition(async () => {
      const result = await reportAction({
        targetType,
        targetId,
        reason,
        details: details || undefined,
      }).catch(() => null);
      onBusy(false);
      if (!result) return setFormError('Something went wrong. Try again.');
      if (result.ok) return setSent(true);
      const errors = result.error.fieldErrors ?? {};
      const known: Record<string, string> = {};
      for (const key of ['reason', 'details']) if (errors[key]?.[0]) known[key] = errors[key][0];
      setFieldErrors(known);
      const unmapped = errors.targetId?.[0];
      if (unmapped) setFormError(unmapped);
      else if (Object.keys(known).length === 0) setFormError(result.error.message);
    });
  }

  return (
    <div>
      <h2 id="report-dialog-title" className="varsity text-[1.75rem] font-extrabold">
        {title}
      </h2>
      {sent ? (
        <div className="mt-4 space-y-4">
          <p role="status" className="rounded-md bg-ok-bg px-4 py-3 text-sm font-medium text-ok">
            {REPORT_SENT}
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-5">
          <fieldset
            role="radiogroup"
            aria-invalid={fieldErrors.reason ? true : undefined}
            className="space-y-2"
            aria-describedby={fieldErrors.reason ? `${id}-reason-error` : undefined}
          >
            <legend className="mb-1 text-[13px] font-semibold text-ink">
              Why are you reporting this?
            </legend>
            {REPORT_REASONS.map((value, index) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-line-2 px-3 py-2.5 text-sm text-ink hover:border-ink-3 has-checked:border-school has-checked:bg-school-tint"
              >
                <input
                  type="radio"
                  ref={index === 0 ? firstRadio : undefined}
                  name="reason"
                  value={value}
                  className="size-4 accent-school"
                  checked={reason === value}
                  onChange={() => setReason(value)}
                />
                {REPORT_REASON_LABELS[value]}
              </label>
            ))}
            <FieldError id={`${id}-reason-error`} message={fieldErrors.reason} />
          </fieldset>
          <div className="space-y-1.5">
            <label htmlFor={`${id}-details`} className="text-[13px] font-semibold text-ink">
              Anything else we should know?
            </label>
            <textarea
              id={`${id}-details`}
              ref={detailsField}
              rows={4}
              maxLength={REPORT_DETAILS_MAX}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              aria-invalid={fieldErrors.details ? true : undefined}
              aria-describedby={fieldErrors.details ? `${id}-details-error` : undefined}
              className="w-full rounded-md border border-line-2 bg-background px-3 py-2 text-sm text-ink outline-none hover:border-ink-3 focus-visible:border-school focus-visible:ring-3 focus-visible:ring-school/20"
            />
            <FieldError id={`${id}-details-error`} message={fieldErrors.details} />
          </div>
          {formError && (
            <p role="alert" className="rounded-md bg-bad-bg px-3 py-2 text-sm font-medium text-bad">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Send report
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
