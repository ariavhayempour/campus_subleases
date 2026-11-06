import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const TABLE = 'w-full border-collapse text-left text-sm tabular-nums';
export const TH =
  'varsity border-b border-line-2 px-2.5 py-3 text-xs font-bold tracking-[0.08em] whitespace-nowrap text-ink-2 first:pl-0';
export const TD = 'border-b border-line px-2.5 py-3 align-middle first:pl-0';
export const LINK =
  'font-semibold text-ink underline decoration-line-2 underline-offset-4 hover:decoration-ink';
export const SELECT =
  'h-10 rounded-md border border-line-2 bg-background px-3 text-sm text-ink hover:border-ink-3';

type HeaderProps = {
  title: string;
  back?: { href: string; label: string };
  actions?: ReactNode;
  children?: ReactNode;
};

export function AdminPageHeader({ title, back, actions, children }: HeaderProps) {
  return (
    <header className="space-y-3 border-b-2 border-ink pb-5">
      {back && (
        <Link
          href={back.href}
          prefetch={false}
          className="inline-flex items-center gap-1 text-sm font-semibold text-ink-2 no-underline hover:text-ink"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="varsity min-w-0 text-[2.5rem] font-black break-words">{title}</h1>
        {actions}
      </div>
      {children}
    </header>
  );
}

export function AdminSection({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className={cn('space-y-3', className)}>
      <h2 id={`${id}-heading`} className="varsity text-[1.375rem] font-extrabold tracking-[0.02em]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Empty({ children = 'Nothing here.' }: { children?: ReactNode }) {
  return <p className="rounded-md bg-surface-2 px-4 py-5 text-sm text-ink-2">{children}</p>;
}

// A school name with its color swatch, so mixed-school tables scan by color.
export function SchoolLabel({ name, color }: { name: string; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold whitespace-nowrap">
      <i
        aria-hidden="true"
        className="size-2.5 rounded-[2px] bg-line-2"
        style={{ background: color }}
      />
      {name}
    </span>
  );
}

// Divided list rows for reports, history, and conversations.
export function RowList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-line border-y border-line text-sm">{children}</ul>;
}

export function Row({ children }: { children: ReactNode }) {
  return <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-3">{children}</li>;
}

export const Dot = () => (
  <span aria-hidden="true" className="text-ink-3">
    ·
  </span>
);
