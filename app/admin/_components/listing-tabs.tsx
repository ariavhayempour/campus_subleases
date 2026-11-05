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
    <nav aria-label="Review status" className="flex gap-1 border-b">
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
              '-mb-px border-b-2 border-transparent px-4 py-2 text-sm hover:bg-muted',
              active && 'border-foreground font-medium',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
