import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <p aria-hidden="true" className="numeral text-[clamp(7rem,18vw,12rem)] text-school">
        404
      </p>
      <h1 className="varsity mt-4 text-[2.5rem] font-black text-ink">Page not found</h1>
      <p className="mt-3 max-w-[52ch] text-[16px] text-ink-2">
        It may have been removed, or the link is wrong.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">Go home</Link>
      </Button>
    </main>
  );
}
