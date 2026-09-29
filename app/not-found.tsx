import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">It may have been removed, or the link is wrong.</p>
      <Link href="/" className="mt-6 inline-block underline">
        Go home
      </Link>
    </main>
  );
}
