import type { ReactNode } from 'react';

type StaticPageProps = { title: string; lastUpdated?: string; children: ReactNode };

export function StaticPage({ title, lastUpdated, children }: StaticPageProps) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="max-w-[70ch]">
        <h1 className="varsity text-[clamp(2.75rem,6vw,4.5rem)] font-black text-ink">{title}</h1>
        {lastUpdated && <p className="mt-3 text-sm text-ink-2">Last updated {lastUpdated}</p>}
        <div aria-hidden="true" className="mt-6 h-1 w-16 bg-school" />
        <div className="mt-8 space-y-4 text-[16px] leading-7 text-ink [&_a]:font-medium [&_a]:text-school-link [&_a]:underline [&_h2]:pt-6 [&_h2]:font-display [&_h2]:text-[1.875rem] [&_h2]:leading-[0.95] [&_h2]:font-extrabold [&_h2]:tracking-[0.02em] [&_h2]:uppercase [&_li]:mt-1 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6 [&_ul]:marker:text-ink-3">
          {children}
        </div>
      </div>
    </main>
  );
}
