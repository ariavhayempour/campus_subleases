import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SchoolRibbon } from '@/app/_components/school-ribbon';
import { buttonVariants } from '@/components/ui/button';
import { APP_NAME } from '@/lib/app-config';
import { cn } from '@/lib/utils';
import { getActor } from '@/server/auth/get-actor';
import { listActiveSchools } from '@/server/services/schools';
import { getOnboardingState } from '@/server/services/users';

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME}: student subleases near campus` },
  description:
    'Students sublease their own apartments, houses, and rooms to other students. Every listing reviewed, always free.',
  alternates: { canonical: '/' },
};

const STEPS = [
  {
    title: 'Create an account',
    body: 'A username or email and a password. Free, and it takes a minute.',
  },
  {
    title: 'Pick your home school',
    body: 'Chosen once. You’ll see that school’s listings, map, and colors.',
  },
  {
    title: 'Browse or post',
    body: 'Save listings, message hosts, or post your own place for review.',
  },
];

const PROMISES = [
  {
    term: 'Students only',
    detail: 'Hosts are students subleasing their own place. No landlords or property managers.',
  },
  {
    term: 'Every listing reviewed',
    detail: 'A person checks each listing before it goes live, usually within 24 hours.',
  },
  {
    term: 'Free, no payments',
    detail:
      'Posting and browsing cost nothing. The site never handles money; you arrange that with the host.',
  },
  {
    term: 'Unit number kept private',
    detail:
      'Listings show the street. The unit only shows to students in a conversation with the host.',
  },
];

const TERMS = ['Jan–Apr', 'May–Aug', 'Sep–Dec'];

const ctaLarge = 'h-13 gap-2 px-6 text-base';

export default async function HomePage() {
  const actor = await getActor();
  if (actor.kind === 'user') {
    const state = await getOnboardingState(actor);
    if (state.needsOnboarding) redirect('/onboarding');
    if (state.homeSchoolSlug) redirect(`/${state.homeSchoolSlug}`);
  }
  const schools = await listActiveSchools();

  return (
    <main className="flex-1">
      <section className="on-school flex min-h-[min(calc(100svh-4rem),58rem)] flex-col bg-ink pt-14 text-white selection:bg-white selection:text-ink sm:pt-16">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="varsity max-w-[19ch] text-[clamp(3.25rem,min(9.5vw,calc(40svh-14rem)),8.5rem)] leading-[0.88] font-black">
            Sublet near campus, student to student.
          </h1>
          <p className="mt-6 max-w-[48ch] text-[17px] leading-relaxed text-white/88 sm:text-[19px]">
            Sublease your place while you’re away, or find one for the summer, a semester, or an
            internship. Students only, every listing reviewed by a person, always free.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link
              href="/sign-up"
              className={cn(buttonVariants({ variant: 'highlight' }), ctaLarge)}
            >
              Create your free account
            </Link>
            <a
              href="#schools"
              className="font-semibold text-white underline underline-offset-4 hover:no-underline"
            >
              or look around first
            </a>
          </div>
        </div>
        <div className="mt-auto pt-10">
          <SchoolRibbon id="schools" schools={schools} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <h2 className="varsity max-w-[18ch] text-[clamp(2.5rem,5vw,4rem)] font-black text-ink">
          Away for a term? Someone needs your place.
        </h2>
        <p className="mt-5 max-w-[62ch] text-[17px] leading-relaxed text-ink-2">
          Students leave for internships, study abroad, and summers at home, and other students
          arrive for those same months. {APP_NAME} puts the two in touch, one school at a time.
        </p>
        <SummerMatch />
        <div className="mt-14 grid gap-12 md:grid-cols-2 md:gap-0">
          <div className="md:border-r md:border-line md:pr-12">
            <h3 className="varsity text-[1.75rem] font-extrabold text-ink">Leaving</h3>
            <p className="mt-3 max-w-[48ch] text-[16px] leading-relaxed text-ink-2">
              Post your apartment, house, or room with photos, dates, and rent. Once a person
              reviews it, students at your school can find it and message you here.
            </p>
            <Link
              href="/sign-up"
              className="mt-5 inline-flex items-center gap-1.5 font-semibold text-ink"
            >
              Post your place
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <div className="md:pl-12">
            <h3 className="varsity text-[1.75rem] font-extrabold text-ink">Looking</h3>
            <p className="mt-3 max-w-[48ch] text-[16px] leading-relaxed text-ink-2">
              Filter by rent, dates, bedrooms, and distance to campus, see every place on a map, and
              message the host without leaving the site.
            </p>
            <a
              href="#schools"
              className="mt-5 inline-flex items-center gap-1.5 font-semibold text-ink"
            >
              Browse a school
              <ArrowRight aria-hidden className="size-4" />
            </a>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-surface-2">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <h2 className="varsity text-[clamp(2.5rem,5vw,4rem)] font-black text-ink">
            Three steps to your school.
          </h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((step, index) => (
              <li key={step.title} className="border-t-2 border-ink pt-5">
                <span aria-hidden className="numeral block text-[3.75rem] text-ink">
                  {index + 1}
                </span>
                <h3 className="varsity mt-3 text-[1.375rem] font-extrabold tracking-[0.02em] text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-[36ch] text-[15px] text-ink-2">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[5fr_7fr] lg:gap-16 lg:px-8 lg:py-28">
        <h2 className="varsity max-w-[12ch] text-[clamp(2.5rem,5vw,4rem)] font-black text-ink lg:sticky lg:top-24 lg:self-start">
          Students only, checked by people.
        </h2>
        <dl className="divide-y divide-line border-y border-line">
          {PROMISES.map((promise) => (
            <div key={promise.term} className="grid gap-2 py-6 sm:grid-cols-[14rem_1fr] sm:gap-8">
              <dt className="varsity text-[1.375rem] font-extrabold tracking-[0.02em] text-ink">
                {promise.term}
              </dt>
              <dd className="max-w-[52ch] text-[16px] leading-relaxed text-ink-2">
                {promise.detail}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="on-school bg-ink text-white selection:bg-white selection:text-ink">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-16 sm:px-6 md:flex-row md:items-end md:justify-between lg:px-8 lg:py-20">
          <h2 className="varsity max-w-[14ch] text-[clamp(2.5rem,5vw,4rem)] font-black">
            Find a place, or fill yours.
          </h2>
          <div className="flex flex-col items-start gap-4 md:items-end">
            <Link
              href="/sign-up"
              className={cn(buttonVariants({ variant: 'highlight' }), ctaLarge)}
            >
              Create your free account
            </Link>
            <p className="text-sm text-white/80">
              Don’t see your school?{' '}
              <Link
                href="/contact"
                className="font-semibold text-white underline underline-offset-4 hover:no-underline"
              >
                Tell us
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

// Illustrative timeline: a host away May–Aug and a student who needs those months, on the term axis.
function SummerMatch() {
  const rows = [
    { who: 'You’re away for an internship', tone: 'bg-ink' },
    { who: 'A student needs a place for the summer', tone: 'bg-ink-2' },
  ];
  return (
    <figure className="mt-12 rounded-md bg-surface-2 p-5 sm:p-8">
      <div className="grid grid-cols-3 gap-1">
        {TERMS.map((term) => (
          <span key={term} className="varsity text-[12px] font-bold tracking-[0.06em] text-ink-2">
            {term}
          </span>
        ))}
      </div>
      <div className="mt-3 grid gap-4">
        {rows.map((row) => (
          <div key={row.who}>
            <div className="grid grid-cols-3 gap-1" aria-hidden>
              <span className="h-8 rounded-[2px] bg-line" />
              <span className={cn('h-8 rounded-[2px]', row.tone)} />
              <span className="h-8 rounded-[2px] bg-line" />
            </div>
            <p className="mt-2 text-[13px] text-ink-2 sm:text-sm">
              <span className="font-semibold text-ink">{row.who}</span>, May through August
            </p>
          </div>
        ))}
      </div>
      <figcaption className="mt-5 text-[13px] text-ink-2">
        Example. Every listing on {APP_NAME} draws its dates on this same term calendar.
      </figcaption>
    </figure>
  );
}
