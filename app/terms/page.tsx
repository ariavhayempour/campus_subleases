import type { Metadata } from 'next';
import Link from 'next/link';
import { StaticPage } from '@/app/_components/static-page';
import { APP_NAME } from '@/lib/app-config';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: `The rules for using ${APP_NAME}.`,
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <StaticPage title="Terms of Use" lastUpdated="November 4, 2026">
      <p>
        These terms apply to everyone who uses {APP_NAME} (&quot;we&quot;, &quot;us&quot;). By
        creating an account or using the site, you agree to them. If you do not agree, do not use
        the site.
      </p>

      <h2>Who can use {APP_NAME}</h2>
      <ul>
        <li>You must be at least 18 years old.</li>
        <li>You must be a current college or university student.</li>
        <li>
          {APP_NAME} is for students subleasing their own housing. Landlords, property managers,
          brokers, and anyone listing a place that is not their own may not post.
        </li>
        <li>
          One account per person. Keep your password private; you are responsible for your account.
        </li>
      </ul>

      <h2>Listings</h2>
      <ul>
        <li>
          Listings must be real, accurate, and for a place you currently live in or rent and have
          the right to sublease. Check your lease: many require the landlord&apos;s consent.
        </li>
        <li>
          Every listing is reviewed before it appears. We may reject, hide, or remove any listing at
          our discretion, including after it has been approved.
        </li>
        <li>
          You keep ownership of what you post. You give us permission to store, display, and resize
          it on the site, and to show it in link previews, for as long as it is posted.
        </li>
      </ul>

      <h2>What is not allowed</h2>
      <ul>
        <li>Scams, fake listings, or listings for a place you cannot sublease.</li>
        <li>
          Asking for money, a deposit, or payment details before the renter has seen the place in
          person.
        </li>
        <li>Harassment, threats, hate speech, or spam, in listings or messages.</li>
        <li>Pretending to be someone else, or using someone else&apos;s account.</li>
        <li>
          Scraping the site, collecting other users&apos; information, or interfering with how the
          site works.
        </li>
      </ul>
      <p>
        We may suspend or ban accounts that break these rules. You can report listings, messages,
        and users from the site.
      </p>

      <h2>Subleases are between you and the other student</h2>
      <p>
        {APP_NAME} is free and does not handle payments. We do not own, inspect, or manage any
        listed place, and we are not a party to any sublease or agreement you make. You are
        responsible for checking the place, the person, and your lease before you agree to anything.
        We are not affiliated with any university.
      </p>

      <h2>No warranty</h2>
      <p>
        The site is provided &quot;as is&quot;. We do not guarantee that listings are accurate, that
        the site will always be available, or that any sublease will work out. To the fullest extent
        the law allows, we are not liable for losses that come from using the site or from dealings
        between users.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time in your settings. We may suspend or end access for
        anyone who breaks these terms.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. When we do, we will change the date at the top of this page.
        Using the site after a change means you accept the new terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? <Link href="/contact">Contact us</Link>. See also our{' '}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </StaticPage>
  );
}
