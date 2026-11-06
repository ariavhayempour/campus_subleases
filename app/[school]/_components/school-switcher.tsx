'use client';

import { useRouter } from 'next/navigation';
import { useId } from 'react';
import type { SchoolSummary } from '@/server/services/schools';

type SchoolSwitcherProps = { current: string; schools: Pick<SchoolSummary, 'slug' | 'name'>[] };

// Admin-only; filters are per school, so switching starts the new school unfiltered.
export function SchoolSwitcher({ current, schools }: SchoolSwitcherProps) {
  const router = useRouter();
  const id = useId();
  return (
    <div className="text-[13px]">
      <label htmlFor={id} className="mb-1 block font-semibold">
        Viewing school
      </label>
      <select
        id={id}
        value={current}
        onChange={(event) => router.push(`/${event.target.value}`)}
        className="h-10 w-full min-w-48 rounded-md border border-line-2 bg-background px-3 text-sm font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-background/60"
      >
        {schools.map((school) => (
          <option key={school.slug} value={school.slug}>
            {school.name}
          </option>
        ))}
      </select>
    </div>
  );
}
