import type { Metadata } from 'next';
import Link from 'next/link';
import { StaticPage } from '@/app/_components/static-page';
import { APP_NAME } from '@/lib/app-config';
import { SAFETY_NOTICE } from '@/lib/messaging-options';

export const metadata: Metadata = {
  title: 'About',
  description: `How ${APP_NAME} works: students sublease their own place to other students, for free.`,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <StaticPage title={`About ${APP_NAME}`}>
      <p>
        {APP_NAME} is a free place for college students to sublease their own apartment, house, or
        room to other students, and to find a sublease near campus. It is for students only: not
        landlords or property managers.
      </p>

      <h2>How it works</h2>
      <ul>
        <li>
          Hosts post their place with photos, dates, and rent. We review every listing before it
          appears, usually within 24 hours.
        </li>
        <li>
          Renters browse by school, filter by price, dates, and more, and see listings on a map.
        </li>
        <li>
          Renters message hosts on the site. The exact unit number is shared only with people who
          message the host.
        </li>
        <li>When the place is taken, the host marks the listing taken and it comes down.</li>
      </ul>

      <h2>Staying safe</h2>
      <ul>
        <li>{SAFETY_NOTICE}</li>
        <li>
          Check that your lease allows subleasing. Many leases need the landlord&apos;s written
          consent.
        </li>
        <li>Put the sublease in writing before you move in or hand over keys.</li>
        <li>Report listings, messages, or users that seem wrong. We review every report.</li>
      </ul>

      <h2>The fine print</h2>
      <p>
        {APP_NAME} is free and has no ads. We are not affiliated with any university, and we are not
        a party to any sublease made through the site. Read our <Link href="/terms">Terms</Link> and{' '}
        <Link href="/privacy">Privacy Policy</Link>, or <Link href="/contact">contact us</Link>.
      </p>
    </StaticPage>
  );
}
