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
      <summary className="cursor-pointer list-none rounded-md [&::-webkit-details-marker]:hidden px-2 py-1 hover:underline">
        Menu
      </summary>
      <div className="absolute inset-x-0 top-full z-40 flex flex-col gap-3 border-b bg-background px-4 py-3 shadow-md">
        {children}
      </div>
    </details>
  );
}
