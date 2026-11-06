import { ShieldAlert } from 'lucide-react';
import { SAFETY_NOTICE } from '@/lib/messaging-options';

export function SafetyNote() {
  return (
    <p className="flex items-start gap-2.5 bg-warn-bg px-5 py-2.5 text-[13px] font-medium text-[#5c3c00]">
      <ShieldAlert aria-hidden="true" className="mt-px size-4 shrink-0" />
      <span>{SAFETY_NOTICE}</span>
    </p>
  );
}
