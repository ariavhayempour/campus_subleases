'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAME } from '@/lib/app-config';

const FOOTER_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/contact', label: 'Contact' },
] as const;

export function SiteFooter() {
  // The messages screen fills the viewport below the header; a footer would make it scroll.
  const pathname = usePathname();
  if (pathname === '/messages' || pathname.startsWith('/messages/')) return null;
  return (
    <footer className="mt-auto border-t border-line bg-surface-2">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-7 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>
          <span className="font-semibold text-ink">{APP_NAME}</span> is free and for students only.
          Not affiliated with any university.
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-ink no-underline hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
