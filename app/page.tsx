import { ArrowRight, Check } from 'lucide-react';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LandingAccent } from '@/app/_components/landing-accent';
import { LandingReveal } from '@/app/_components/landing-reveal';
import { SchoolRibbon } from '@/app/_components/school-ribbon';
import { TermMatch } from '@/app/_components/term-match';
import { buttonVariants } from '@/components/ui/button';
import { APP_NAME } from '@/lib/app-config';
import { NEUTRAL_THEME, schoolGlowColor, schoolThemeStyle } from '@/lib/school-theme';
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

const ctaLarge = 'group h-13 gap-2.5 px-6 text-base';
const ctaArrow =
  'size-4 transition-transform duration-200 ease-out-expo group-hover:translate-x-[3px]';
// The hero lights one glow per school, up to this many.
const MAX_LIGHTS = 4;

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
      <section
        data-lights=""
        className="on-school relative isolate flex min-h-[min(calc(100svh-4rem),58rem)] flex-col overflow-hidden bg-ink pt-14 text-white selection:bg-white selection:text-ink sm:pt-16"
      >
        <div aria-hidden className="landing-lights">
          {schools.slice(0, MAX_LIGHTS).map((school) => (
            <span
              key={school.slug}
              className="landing-glow"
              style={{ '--glow': schoolGlowColor(school.theme) } as CSSProperties}
            />
          ))}
        </div>
        <div aria-hidden className="landing-grain" />
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="varsity max-w-[19ch] text-[clamp(3.25rem,min(9.5vw,calc(40svh-14rem)),8.5rem)] leading-[0.88] font-black">
            <span className="landing-line">
              <span>Sublet near campus, </span>
            </span>
            <span className="landing-line">
              <span className="landing-hollow">student to student.</span>
            </span>
          </h1>
          <div className="landing-enter">
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
                <ArrowRight aria-hidden className={ctaArrow} />
              </Link>
              <a
                href="#schools"
                className="font-semibold text-white underline underline-offset-4 hover:no-underline"
              >
                or look around first
              </a>
            </div>
          </div>
        </div>
        <div className="mt-auto pt-10">
          <SchoolRibbon id="schools" schools={schools} />
        </div>
      </section>

      <LandingAccent schools={schools}>
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <h2 className="varsity max-w-[18ch] text-[clamp(2.5rem,5vw,4rem)] font-black text-ink">
            Away for a term? Someone needs your place.
          </h2>
          <p className="mt-5 max-w-[62ch] text-[17px] leading-relaxed text-ink-2">
            Students leave for internships, study abroad, and summers at home, and other students
            arrive for those same months. {APP_NAME} puts the two in touch, one school at a time.
          </p>
          <TermMatch />
          <div className="mt-14 grid gap-12 md:grid-cols-2 md:gap-0">
            <div className="md:border-r md:border-line md:pr-12">
              <h3 className="varsity text-[1.75rem] font-extrabold text-ink">Leaving</h3>
              <p className="mt-3 max-w-[48ch] text-[16px] leading-relaxed text-ink-2">
                Post your apartment, house, or room with photos, dates, and rent. Once a person
                reviews it, students at your school can find it and message you here.
              </p>
              <Link
                href="/sign-up"
                className="group mt-5 inline-flex items-center gap-1.5 font-semibold text-school-link no-underline transition-colors duration-500"
              >
                Post your place
                <ArrowRight aria-hidden className={ctaArrow} />
              </Link>
            </div>
            <div className="md:pl-12">
              <h3 className="varsity text-[1.75rem] font-extrabold text-ink">Looking</h3>
              <p className="mt-3 max-w-[48ch] text-[16px] leading-relaxed text-ink-2">
                Filter by rent, dates, bedrooms, and distance to campus, see every place on a map,
                and message the host without leaving the site.
              </p>
              <a
                href="#schools"
                className="group mt-5 inline-flex items-center gap-1.5 font-semibold text-school-link no-underline transition-colors duration-500"
              >
                Browse a school
                <ArrowRight aria-hidden className={ctaArrow} />
              </a>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-surface-2">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <h2 className="varsity text-[clamp(2.5rem,5vw,4rem)] font-black text-ink">
              Three steps to your school.
            </h2>
            <ol data-reveal="" className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="landing-step"
                  style={{ '--i': index } as CSSProperties}
                >
                  <span aria-hidden className="landing-step-numeral numeral block text-[3.75rem]">
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
          <dl data-reveal="" className="divide-y divide-line border-y border-line">
            {PROMISES.map((promise, index) => (
              <div
                key={promise.term}
                className="landing-promise grid gap-2 py-6 sm:grid-cols-[14rem_1fr] sm:gap-8"
                style={{ '--i': index } as CSSProperties}
              >
                <dt className="varsity flex items-start gap-2.5 text-[1.375rem] font-extrabold tracking-[0.02em] text-ink">
                  <span
                    aria-hidden
                    className="mt-px grid size-5 shrink-0 place-items-center rounded-[2px] bg-school text-on-school transition-colors duration-500"
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  {promise.term}
                </dt>
                <dd className="max-w-[52ch] text-[16px] leading-relaxed text-ink-2">
                  {promise.detail}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          data-reveal=""
          className="on-school relative isolate overflow-hidden bg-ink text-white selection:bg-white selection:text-ink"
        >
          <div aria-hidden className="landing-guard flex h-3.5">
            {schools.map((school, index) => (
              <span
                key={school.slug}
                className="flex-1 border-b-4 border-school-secondary bg-school"
                style={{ ...schoolThemeStyle(school.theme), '--i': index } as CSSProperties}
              />
            ))}
          </div>
          <div aria-hidden className="landing-glow landing-glow-closing" />
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-16 sm:px-6 md:flex-row md:items-end md:justify-between lg:px-8 lg:py-20">
            <h2 className="varsity max-w-[14ch] text-[clamp(2.5rem,5vw,4rem)] font-black">
              Find a place, or fill yours.
            </h2>
            {/* The account call stays white on ink whichever school dresses the band. */}
            <div
              className="flex flex-col items-start gap-4 md:items-end"
              style={schoolThemeStyle(NEUTRAL_THEME)}
            >
              <Link
                href="/sign-up"
                className={cn(buttonVariants({ variant: 'highlight' }), ctaLarge)}
              >
                Create your free account
                <ArrowRight aria-hidden className={ctaArrow} />
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
      </LandingAccent>
      <LandingReveal />
    </main>
  );
}
