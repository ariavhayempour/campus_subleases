'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';

export function SiteHeaderMenu({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const ref = useRef<HTMLDetailsElement>(null);

  // A native <details> stays open across client navigations, so close it on every route change.
  useEffect(() => {
    ref.current?.removeAttribute('open');
  }, [pathname]);

  return (
    <details ref={ref} className={className}>
      <summary className="cursor-pointer list-none rounded-md px-2 py-1.5 text-sm font-semibold text-on-school hover:bg-white/10 [&::-webkit-details-marker]:hidden">
        Menu
      </summary>
      <div className="absolute inset-x-0 top-full z-40 flex flex-col gap-1 border-b border-line bg-background px-4 py-3 text-[15px] font-medium text-ink shadow-[0_8px_24px_rgb(21_23_28/0.12)] [&>a]:py-2">
        {children}
      </div>
    </details>
  );
}
