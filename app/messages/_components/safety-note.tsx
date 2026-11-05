import { SAFETY_NOTICE } from '@/lib/messaging-options';

export function SafetyNote() {
  return <p className="mx-4 mt-3 rounded-md border bg-muted px-3 py-2 text-sm">{SAFETY_NOTICE}</p>;
}
