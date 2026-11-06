import Link from 'next/link';
import type { ReviewStatus } from '@/lib/listing-options';
import { cn } from '@/lib/utils';

export const TABS: { key: ReviewStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'rejected', label: 'Rejected' },
];

export function ListingTabs({ tab, school }: { tab: ReviewStatus; school: string }) {
  return (
    <nav aria-label="Review status" className="flex gap-0.5">
      {TABS.map(({ key, label }) => {
        const query = new URLSearchParams({ tab: key });
        if (school) query.set('school', school);
        const active = key === tab;
        return (
          <Link
            key={key}
            href={`/admin/listings?${query.toString()}`}
            prefetch={false}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative -mb-px px-3.5 py-2.5 text-sm font-semibold text-ink-2 no-underline hover:text-ink',
              active &&
                'text-ink after:absolute after:inset-x-2.5 after:bottom-0 after:h-[3px] after:bg-ink',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
