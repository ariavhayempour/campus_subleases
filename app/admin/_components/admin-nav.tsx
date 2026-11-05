'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/listings', label: 'Listings' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/stats', label: 'Stats' },
  { href: '/admin/audit', label: 'Audit log' },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="w-44 shrink-0">
      <ul className="space-y-1 text-sm">
        {ITEMS.map(({ href, label }) => {
          const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                prefetch={false}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block rounded-md px-3 py-2 hover:bg-muted',
                  active && 'bg-muted font-medium',
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
