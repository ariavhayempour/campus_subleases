'use client';

import { Check } from 'lucide-react';
import { type CSSProperties, useRef } from 'react';
import { useLandingAccent } from '@/app/_components/landing-accent';
import { APP_NAME } from '@/lib/app-config';
import { cn } from '@/lib/utils';

const TERMS = ['Jan–Apr', 'May–Aug', 'Sep–Dec'];

const ROWS = [
  { who: 'You’re away for an internship', bar: 'landing-bar-host' },
  { who: 'A student needs a place for the summer', bar: 'landing-bar-guest' },
];

// Illustrative timeline: a host away May–Aug and a student who needs those months, on the term axis.
export function TermMatch() {
  const { schools, current, choose } = useLandingAccent();
  const figure = useRef<HTMLElement>(null);

  const pick = (slug: string) => {
    choose(slug);
    const el = figure.current;
    if (!el || el.dataset.reveal !== 'in') return;
    // Snaps the bars back to empty, then lets them draw in again in the new colors.
    el.dataset.reveal = 'reset';
    void el.offsetWidth;
    el.dataset.reveal = 'in';
  };

  return (
    <figure
      ref={figure}
      data-reveal=""
      className="mt-12 rounded-md bg-school-tint p-5 transition-colors duration-500 sm:p-8"
    >
      {schools.length > 1 && (
        <div className="mb-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <span id="term-match-schools" className="text-[13px] font-semibold text-ink">
            See it in your school’s colors
          </span>
          <div role="group" aria-labelledby="term-match-schools" className="flex flex-wrap gap-1.5">
            {schools.map((school) => (
              <button
                key={school.slug}
                type="button"
                aria-pressed={school.slug === current?.slug}
                onClick={() => pick(school.slug)}
                style={
                  {
                    backgroundColor: school.theme.primary,
                    color: school.theme.onPrimary,
                    '--chip-mark': school.theme.secondary,
                  } as CSSProperties
                }
                className="landing-chip varsity h-[34px] rounded-[2px] px-3 pb-0.5 text-[15px] font-extrabold tracking-[0.04em]"
              >
                {school.shortName}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-1">
        {TERMS.map((term) => (
          <span key={term} className="varsity text-[12px] font-bold tracking-[0.06em] text-ink-2">
            {term}
          </span>
        ))}
      </div>
      <div className="mt-3 grid gap-4">
        {ROWS.map((row) => (
          <div key={row.who}>
            <div className="grid grid-cols-3 gap-1" aria-hidden>
              <span className="h-8 rounded-[2px] bg-ink/8" />
              <span className="relative h-8 overflow-hidden rounded-[2px]">
                <span className={cn('absolute inset-0 rounded-[2px]', row.bar)} />
              </span>
              <span className="h-8 rounded-[2px] bg-ink/8" />
            </div>
            <p className="mt-2 text-[13px] text-ink-2 sm:text-sm">
              <span className="font-semibold text-ink">{row.who}</span>, May through August
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <span className="landing-matched varsity inline-flex h-[26px] items-center gap-1.5 rounded-[2px] bg-highlight px-2.5 pb-px text-[14px] font-extrabold tracking-[0.06em] text-on-highlight transition-colors duration-500">
          <Check aria-hidden className="size-3.5" strokeWidth={3} />
          Same months
        </span>
        <figcaption className="text-[13px] text-ink-2">
          Example. Every listing on {APP_NAME} draws its dates on this same term calendar.
        </figcaption>
      </div>
    </figure>
  );
}
