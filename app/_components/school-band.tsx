import type { ReactNode } from 'react';
import type { SchoolSummary } from '@/server/services/schools';

type SchoolBandProps = {
  school: Pick<SchoolSummary, 'shortName' | 'city' | 'campusName'>;
  // Accessible page heading; the band shows the school name large beside it.
  heading: string;
  aside?: ReactNode;
};

export function SchoolBand({ school, heading, aside }: SchoolBandProps) {
  const sub = [`Subleases from students near ${school.campusName}`, school.city]
    .filter(Boolean)
    .join(' · ');
  return (
    <section className="on-school bg-school text-on-school">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 pt-3 pb-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <h1>
            <span className="sr-only">{heading}</span>
            <span
              aria-hidden="true"
              className="varsity block text-[clamp(3.25rem,7vw,5.75rem)] font-black"
            >
              {school.shortName}
            </span>
          </h1>
          <p className="mt-2 text-[15px]">{sub}</p>
        </div>
        {aside}
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div aria-hidden="true" className="varsity-stripe mb-2.5" />
      </div>
    </section>
  );
}
