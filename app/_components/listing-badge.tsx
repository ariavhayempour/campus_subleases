import type { ListingBadge as Badge } from '@/lib/listing-rules';
import { cn } from '@/lib/utils';

const TONES: Record<Badge['tone'], string> = {
  neutral: 'bg-muted text-muted-foreground',
  warning: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  danger: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
  success: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
};

export function ListingBadge({ badge }: { badge: Badge }) {
  return (
    <span
      className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', TONES[badge.tone])}
    >
      {badge.label}
    </span>
  );
}
