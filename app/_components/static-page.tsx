import type { ReactNode } from 'react';

type StaticPageProps = { title: string; lastUpdated?: string; children: ReactNode };

export function StaticPage({ title, lastUpdated, children }: StaticPageProps) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {lastUpdated && (
        <p className="mt-2 text-sm text-muted-foreground">Last updated {lastUpdated}</p>
      )}
      <div className="mt-8 space-y-4 leading-7 [&_a]:underline [&_a]:underline-offset-2 [&_h2]:pt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-1 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
        {children}
      </div>
    </main>
  );
}
