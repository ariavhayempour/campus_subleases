'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui', textAlign: 'center', padding: '6rem 1rem' }}>
        <h1>Something went wrong</h1>
        <p>We&apos;ve been notified. Please reload the page.</p>
      </body>
    </html>
  );
}
