import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/app-config';

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold">
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
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/listings/new" className="hover:underline">
              Post a listing
            </Link>
            <Link href="/me/favorites" className="hover:underline">
              Saved
            </Link>
            <Link href="/me/listings" className="hover:underline">
              My listings
            </Link>
            <UserButton />
          </nav>
        </Show>
      </div>
    </header>
  );
}
