import type { Metadata } from 'next';
import Link from 'next/link';
import { StaticPage } from '@/app/_components/static-page';
import { APP_NAME } from '@/lib/app-config';
import { ContactForm } from './contact-form';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Send a message to the ${APP_NAME} team.`,
};

export default function ContactPage() {
  return (
    <StaticPage title="Contact us">
      <p>
        Questions, feedback, or a problem with the site? Send us a message and we will reply by
        email. To flag a specific listing, message, or user, use the Report option on it so we see
        the details. See <Link href="/about">how {APP_NAME} works</Link>.
      </p>
      <ContactForm />
    </StaticPage>
  );
}
