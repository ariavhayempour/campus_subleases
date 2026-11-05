import type { Metadata } from 'next';
import Link from 'next/link';
import { StaticPage } from '@/app/_components/static-page';
import { APP_NAME } from '@/lib/app-config';
import { DELETED_USER_LABEL } from '@/lib/messaging-options';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `What ${APP_NAME} collects, who can see it, and how to delete it.`,
};

export default function PrivacyPage() {
  return (
    <StaticPage title="Privacy Policy" lastUpdated="November 4, 2026">
      <p>
        This policy explains what {APP_NAME} collects, who can see it, and how you can delete it. We
        do not sell your information, show ads, or use third-party analytics.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account:</strong> your first and last name, email address, and password. Your
          password is handled by our sign-in provider; we never see it.
        </li>
        <li>
          <strong>School:</strong> the home school you choose.
        </li>
        <li>
          <strong>Listings:</strong> what you post, including the address, dates, rent, details, and
          photos.
        </li>
        <li>
          <strong>Messages:</strong> the messages you send and receive on the site.
        </li>
        <li>
          <strong>Activity on the site:</strong> listings you save, users you block, and reports you
          make.
        </li>
        <li>
          <strong>Contact form:</strong> the name, email address, and message you send us.
        </li>
        <li>
          <strong>Technical:</strong> cookies that keep you signed in, and error reports (with your
          account ID and the page you were on) when something breaks.
        </li>
      </ul>

      <h2>Who can see what</h2>
      <ul>
        <li>
          Other users see your display name (first name and last initial; never your full last name)
          and the month you joined. They never see your email address.
        </li>
        <li>
          Public listings show the street address, map location, photos, and details to anyone,
          signed in or not. The unit number is shown only to users who have messaged the host about
          that listing.
        </li>
        <li>
          When you upload a photo, we remove its location data and other camera metadata before
          anyone can see it.
        </li>
        <li>
          Listing pages are excluded from search engines. When a listing link is shared, the preview
          shows its title, price, and cover photo, but never the unit number.
        </li>
        <li>
          Messages are visible to you and the other person in the conversation. Site staff may
          review messages to investigate reports and enforce our <Link href="/terms">Terms</Link>;
          every such review is logged.
        </li>
        <li>
          Site staff can see everything in your account to review listings and handle reports.
        </li>
      </ul>

      <h2>Services we use</h2>
      <p>We share information with these providers only so they can run the site for us:</p>
      <ul>
        <li>Clerk: sign-in and account management.</li>
        <li>Supabase: database, photo storage, and live message delivery.</li>
        <li>Vercel: website hosting.</li>
        <li>
          Mapbox: maps and address search. When you type an address while posting, it is sent to
          Mapbox to find matching places.
        </li>
        <li>Sentry: error reports.</li>
        <li>Web3Forms: delivers contact form messages to us by email.</li>
      </ul>

      <h2>Deleting your account</h2>
      <p>
        You can delete your account at any time in your settings. Deleting it permanently removes
        your account, your listings and their photos, the listings you saved, and your blocks.
      </p>
      <ul>
        <li>
          Your messages stay visible to the other person in each conversation, shown as from &quot;
          {DELETED_USER_LABEL}&quot;.
        </li>
        <li>
          Reports you made, reports about you, and our moderation records are kept so we can keep
          the site safe.
        </li>
        <li>Copies may remain in backups for a limited time before they are overwritten.</li>
      </ul>

      <h2>Age</h2>
      <p>
        {APP_NAME} is for people 18 and older. We do not knowingly collect information from anyone
        younger.
      </p>

      <h2>Changes</h2>
      <p>We may update this policy. When we do, we will change the date at the top of this page.</p>

      <h2>Contact</h2>
      <p>
        Questions or requests about your information? <Link href="/contact">Contact us</Link>.
      </p>
    </StaticPage>
  );
}
