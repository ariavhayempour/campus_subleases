import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { APP_NAME } from '@/lib/app-config';

const FACTS = [
  'Students only. No landlords or property managers.',
  'Every listing is reviewed by a person before it goes live.',
  'Free to post and free to browse.',
];

// Sign-in and sign-up share this split layout: brand panel left, Clerk's form right.
export function AuthShell({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <main className="grid flex-1 lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-ink px-12 py-16 text-white lg:flex">
        <div>
          <h1 className="varsity max-w-[10ch] text-[4rem] font-black">{heading}</h1>
          <ul className="mt-8 grid gap-4 text-[16px]">
            {FACTS.map((fact) => (
              <li key={fact} className="flex items-start gap-3">
                <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                {fact}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/75">{APP_NAME} is not affiliated with any university.</p>
      </section>
      <section className="flex items-center justify-center px-4 py-12">
        <h1 className="sr-only lg:hidden">{heading}</h1>
        {children}
      </section>
    </main>
  );
}
