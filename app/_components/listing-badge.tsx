import type { ListingBadge as Badge } from '@/lib/listing-rules';
import { cn } from '@/lib/utils';

const TONES: Record<Badge['tone'], string> = {
  neutral: 'bg-surface-2 text-ink-2 ring-1 ring-line-2 ring-inset',
  warning: 'bg-warn-bg text-warn',
  danger: 'bg-bad-bg text-bad',
  success: 'bg-ok-bg text-ok',
};

export function ListingBadge({ badge }: { badge: Badge }) {
  return <Tag className={TONES[badge.tone]}>{badge.label}</Tag>;
}

// Block-letter tag; long text (a rejection reason) wraps instead of truncating.
export function Tag({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'varsity inline-flex min-h-[22px] items-center rounded-[2px] px-[7px] py-[3px] text-xs leading-tight font-bold tracking-[0.06em]',
        className,
      )}
    >
      {children}
    </span>
  );
}
