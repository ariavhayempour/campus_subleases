import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { AdminNavLink } from '@/app/_components/admin-nav-link';
import { MessagesNavLink } from '@/app/_components/messages-nav-link';
import { SiteHeaderMenu } from '@/app/_components/site-header-menu';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/app-config';

const NAV_LINKS = [
  { href: '/listings/new', label: 'Post a listing' },
  { href: '/me/favorites', label: 'Saved' },
  { href: '/me/listings', label: 'My listings' },
  { href: '/settings', label: 'Settings' },
];

function NavLinks() {
  return NAV_LINKS.map((link) => (
    <Link key={link.href} href={link.href} className="hover:underline">
      {link.label}
    </Link>
  ));
}

export function SiteHeader() {
  return (
    <header className="relative border-b">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-base font-semibold sm:text-lg">
          {APP_NAME}
        </Link>
        <Show when="signed-out">
          <nav className="flex gap-2">
            <SignInButton>
              <Button variant="ghost">Sign in</Button>
            </SignInButton>
            <SignUpButton>
              <Button>Sign up</Button>
            </SignUpButton>
          </nav>
        </Show>
        <Show when="signed-in">
          <nav className="flex items-center gap-3 text-sm md:gap-4">
            <div className="hidden items-center gap-4 md:flex">
              <NavLinks />
            </div>
            <MessagesNavLink />
            <span className="hidden md:flex">
              <AdminNavLink />
            </span>
            <SiteHeaderMenu className="md:hidden">
              <NavLinks />
              <AdminNavLink />
            </SiteHeaderMenu>
            <UserButton />
          </nav>
        </Show>
      </div>
    </header>
  );
}
