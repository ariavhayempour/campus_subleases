import Link from 'next/link';
import type { ReviewStatus } from '@/lib/listing-options';
import { cn } from '@/lib/utils';
import type { SchoolSummary } from '@/server/services/schools';

type SchoolFilterProps = { tab: ReviewStatus; school: string; schools: SchoolSummary[] };
type Option = { slug: string; label: string; theme: SchoolSummary['theme'] | null };

// Admins switch schools freely; each option wears its school's color when selected.
export function SchoolFilter({ tab, school, schools }: SchoolFilterProps) {
  const options: Option[] = [
    { slug: '', label: 'All schools', theme: null },
    ...schools.map((s) => ({ slug: s.slug, label: s.shortName, theme: s.theme })),
  ];
  return (
    <nav
      aria-label="School"
      className="inline-flex overflow-hidden rounded-md border border-line-2"
    >
      {options.map((option) => {
        const query = new URLSearchParams({ tab });
        if (option.slug) query.set('school', option.slug);
        const active = option.slug === school;
        return (
          <Link
            key={option.slug || 'all'}
            href={`/admin/listings?${query.toString()}`}
            prefetch={false}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 border-line-2 bg-background px-3.5 py-2 text-[13px] font-semibold text-ink no-underline [&+a]:border-l',
              !active && 'hover:bg-surface-2',
            )}
            style={
              active
                ? {
                    background: option.theme?.primary ?? 'var(--ink)',
                    color: option.theme?.onPrimary ?? '#fff',
                  }
                : undefined
            }
          >
            {option.theme && (
              <i
                aria-hidden="true"
                className="size-2.5 rounded-[2px] shadow-[0_0_0_1px_#fff]"
                style={{ background: option.theme.primary }}
              />
            )}
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
