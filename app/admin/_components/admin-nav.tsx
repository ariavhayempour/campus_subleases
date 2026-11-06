'use client';

import { BarChart3, ClipboardList, Flag, LayoutDashboard, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type AdminNavProps = { pendingListings: number; openReports: number };

export function AdminNav({ pendingListings, openReports }: AdminNavProps) {
  const pathname = usePathname();
  const items = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard, count: 0 },
    { href: '/admin/listings', label: 'Listings', icon: ClipboardList, count: pendingListings },
    { href: '/admin/reports', label: 'Reports', icon: Flag, count: openReports },
    { href: '/admin/stats', label: 'Stats', icon: BarChart3, count: 0 },
    { href: '/admin/audit', label: 'Audit log', icon: ScrollText, count: 0 },
  ];
  return (
    <aside className="w-60 shrink-0 bg-ink text-white">
      <nav aria-label="Admin" className="sticky top-0 px-3.5 py-5">
        <p className="varsity px-2.5 pb-4 text-xl font-black tracking-[0.02em]">Admin</p>
        <ul className="grid gap-0.5">
          {items.map(({ href, label, icon: Icon, count }) => {
            const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  prefetch={false}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-[3px] px-2.5 py-2 text-sm font-medium text-[#d5d8de] no-underline hover:bg-white/[0.07] hover:text-white',
                    active && 'bg-white/10 font-bold text-white',
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                  {count > 0 && (
                    <span className="numeral ml-auto min-w-[22px] rounded-full bg-white px-1.5 pt-0.5 text-center text-xs text-ink">
                      {count}
                      <span className="sr-only"> to review</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
