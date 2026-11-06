'use client';

import { ArrowRight, Pause, Play } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@/app/_lib/use-media-query';
import { schoolThemeStyle } from '@/lib/school-theme';
import { cn } from '@/lib/utils';
import type { SchoolSummary } from '@/server/services/schools';

type RibbonSchool = Pick<
  SchoolSummary,
  'slug' | 'name' | 'shortName' | 'city' | 'campusName' | 'theme'
>;

// Block width plus gap, used to repeat the list until one half covers a wide screen.
const BLOCK_PX = 306;
const COVER_PX = 2560;
const SPEED_PX_PER_S = 32;

export function SchoolRibbon({ schools, id }: { schools: RibbonSchool[]; id?: string }) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [paused, setPaused] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const holding = useRef({ hover: false, focus: false, touch: false });

  const half = Math.max(1, Math.ceil(COVER_PX / (Math.max(schools.length, 1) * BLOCK_PX)));
  const copies = half * 2;

  useEffect(() => {
    const el = scroller.current;
    if (!el || reducedMotion || paused) return;
    let frame = 0;
    let last = performance.now();
    let pos = el.scrollLeft;
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      const held = holding.current;
      // Picks up any manual scroll (trackpad, swipe, focus) before moving on from there.
      if (Math.abs(el.scrollLeft - Math.round(pos)) > 1) pos = el.scrollLeft;
      if (!held.hover && !held.focus && !held.touch && document.visibilityState === 'visible') {
        const wrapAt = el.scrollWidth / 2;
        pos += (SPEED_PX_PER_S * dt) / 1000;
        if (pos >= wrapAt) pos -= wrapAt;
        el.scrollLeft = Math.round(pos);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, paused]);

  if (schools.length === 0) return null;

  const hold = (key: 'hover' | 'focus' | 'touch', value: boolean) => {
    holding.current[key] = value;
  };

  return (
    <nav id={id} aria-labelledby="school-ribbon-label" className="scroll-mt-24">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pb-4 sm:px-6 lg:px-8">
        <p id="school-ribbon-label" className="text-sm text-white/80">
          <span className="font-semibold text-white">Browse any school now.</span> Sign up to save
          listings and message hosts.
        </p>
        {!reducedMotion && (
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            aria-label={paused ? 'Play the school ribbon' : 'Pause the school ribbon'}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-white/55 px-3 text-[13px] font-semibold text-white transition-colors hover:bg-white/10"
          >
            {paused ? (
              <Play aria-hidden className="size-3.5" />
            ) : (
              <Pause aria-hidden className="size-3.5" />
            )}
            {paused ? 'Play' : 'Pause'}
          </button>
        )}
      </div>
      {reducedMotion ? (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(16.5rem,1fr))] gap-1.5 sm:grid-cols-[repeat(auto-fit,minmax(18.75rem,1fr))]">
          {schools.map((school) => (
            <RibbonBlock key={school.slug} school={school} />
          ))}
        </ul>
      ) : (
        <div
          ref={scroller}
          onPointerEnter={() => hold('hover', true)}
          onPointerLeave={() => hold('hover', false)}
          onFocus={() => hold('focus', true)}
          onBlur={() => hold('focus', false)}
          onTouchStart={() => hold('touch', true)}
          onTouchEnd={() => hold('touch', false)}
          onTouchCancel={() => hold('touch', false)}
          className={cn(
            'flex gap-1.5 overflow-x-auto',
            paused
              ? '[scrollbar-color:rgb(255_255_255/0.45)_transparent] [scrollbar-width:thin]'
              : '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          )}
        >
          {Array.from({ length: copies }, (_, copy) => (
            // Repeats stay clickable but out of the tab order and accessibility tree.
            <ul key={copy} className="flex shrink-0 gap-1.5" aria-hidden={copy > 0 || undefined}>
              {schools.map((school) => (
                <RibbonBlock
                  key={school.slug}
                  school={school}
                  repeat={copy > 0}
                  className="w-[16.5rem] sm:w-[18.75rem]"
                />
              ))}
            </ul>
          ))}
        </div>
      )}
    </nav>
  );
}

function RibbonBlock({
  school,
  repeat = false,
  className,
}: {
  school: RibbonSchool;
  repeat?: boolean;
  className?: string;
}) {
  return (
    <li style={schoolThemeStyle(school.theme)} className="on-school relative">
      <Link
        href={`/${school.slug}`}
        tabIndex={repeat ? -1 : undefined}
        className={cn(
          'group flex h-40 flex-col bg-school px-5 pt-5 text-on-school no-underline transition-colors duration-300 hover:bg-school-deep focus-visible:-outline-offset-4 sm:h-48',
          className,
        )}
      >
        <span className="varsity text-[2.25rem] font-black sm:text-[2.75rem]">
          {school.shortName}
        </span>
        <span className="mt-2 flex items-center justify-between gap-3 text-sm">
          <span className="truncate">{school.city ?? school.name}</span>
          <span className="flex shrink-0 items-center gap-1 font-semibold">
            Browse
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </span>
        <span className="sr-only">{`, ${school.name} listings near ${school.campusName}`}</span>
        <span aria-hidden className="varsity-stripe mt-auto mb-4 block" />
      </Link>
    </li>
  );
}
