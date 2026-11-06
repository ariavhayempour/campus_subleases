import { Show, SignInButton, SignUpButton } from '@clerk/nextjs';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { AccountMenu } from '@/app/_components/account-menu';
import { AdminNavLink } from '@/app/_components/admin-nav-link';
import { HeaderBrand, HeaderStripe } from '@/app/_components/header-brand';
import { HEADER_LINK, HeaderNavLinks } from '@/app/_components/header-nav';
import { MessagesNavLink } from '@/app/_components/messages-nav-link';
import { SiteHeaderMenu } from '@/app/_components/site-header-menu';
import { Button } from '@/components/ui/button';

const navLink =
  'flex items-center gap-1.5 px-3 text-sm font-medium text-on-school no-underline hover:bg-white/10';

export function SiteHeader() {
  return (
    <header className="on-school relative z-30 bg-school text-on-school">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <HeaderBrand />
        <Show when="signed-out">
          <nav className="flex items-center gap-2" aria-label="Account">
            <Link href="/about" className={`${navLink} hidden h-9 rounded-md md:flex`}>
              How it works
            </Link>
            <SignInButton>
              <Button variant="onSchool" size="sm">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton>
              <Button variant="highlight" size="sm">
                Sign up
              </Button>
            </SignUpButton>
          </nav>
        </Show>
        <Show when="signed-in">
          <nav className="flex h-full items-stretch gap-1" aria-label="Main">
            <div className="hidden items-stretch md:flex">
              <HeaderNavLinks />
              <AdminNavLink className={HEADER_LINK} />
            </div>
            <MessagesNavLink className={HEADER_LINK} />
            <div className="ml-2 flex items-center gap-3">
              <Button asChild variant="highlight" size="sm" className="hidden md:inline-flex">
                <Link href="/listings/new">
                  <Plus aria-hidden="true" />
                  Post a listing
                </Link>
              </Button>
              <SiteHeaderMenu className="md:hidden">
                <Link href="/listings/new">Post a listing</Link>
                <HeaderNavLinks variant="menu" />
                <AdminNavLink className="flex items-center gap-1.5 text-ink" />
              </SiteHeaderMenu>
              <AccountMenu />
            </div>
          </nav>
        </Show>
      </div>
      <HeaderStripe />
    </header>
  );
}
