import { X } from 'lucide-react';
import Link from 'next/link';
import { activeFilterChips } from '@/lib/active-filters';
import { toSearchParams, type SearchFilters } from '@/lib/validation/search';

type ActiveFiltersProps = { schoolSlug: string; filters: SearchFilters };

export function ActiveFilters({ schoolSlug, filters }: ActiveFiltersProps) {
  const chips = activeFilterChips(filters);
  if (chips.length === 0) return null;
  const hrefFor = (without: SearchFilters) => {
    const query = toSearchParams(without).toString();
    return query ? `/${schoolSlug}?${query}` : `/${schoolSlug}`;
  };
  return (
    <ul aria-label="Active filters" className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li key={chip.key}>
          <Link
            href={hrefFor(chip.without)}
            aria-label={`Remove filter: ${chip.label}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-school pr-2.5 pl-3.5 text-[13px] font-semibold text-on-school no-underline transition-colors hover:bg-school-deep"
          >
            {chip.label}
            <X aria-hidden="true" className="size-3.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
