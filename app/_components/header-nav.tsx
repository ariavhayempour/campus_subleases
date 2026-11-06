'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useThemeSchool } from '@/app/_components/school-theme';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/me/favorites', label: 'Saved' },
  { href: '/me/listings', label: 'My listings' },
  { href: '/settings', label: 'Settings' },
];

// The current page's link gets a bar in the school's second color along the header's bottom edge.
export const HEADER_LINK =
  "relative flex items-center gap-1.5 px-3 text-sm font-medium text-on-school no-underline hover:bg-white/10 aria-[current=page]:font-bold aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3 aria-[current=page]:after:bottom-0 aria-[current=page]:after:h-1 aria-[current=page]:after:bg-school-secondary aria-[current=page]:after:content-['']";

export function useIsCurrent(): (href: string) => boolean {
  const pathname = usePathname();
  return (href) => pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderNavLinks({ variant = 'bar' }: { variant?: 'bar' | 'menu' }) {
  const school = useThemeSchool();
  const isCurrent = useIsCurrent();
  const browse = school ? `/${school.slug}` : '/';
  const links = [{ href: browse, label: 'Browse' }, ...LINKS];
  return links.map((link) => (
    <Link
      key={link.label}
      href={link.href}
      aria-current={isCurrent(link.href) && link.href !== '/' ? 'page' : undefined}
      className={cn(variant === 'bar' ? HEADER_LINK : 'text-ink aria-[current=page]:font-bold')}
    >
      {link.label}
    </Link>
  ));
}

export function CurrentLink({
  href,
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Link> & { href: string }) {
  const isCurrent = useIsCurrent();
  return (
    <Link
      href={href}
      aria-current={isCurrent(href) ? 'page' : undefined}
      className={className}
      {...rest}
    >
      {children}
    </Link>
  );
}
