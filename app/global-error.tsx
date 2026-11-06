'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// Replaces the root layout, so it carries its own minimal styling without the app's CSS.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, sans-serif',
          color: '#15171c',
          padding: '6rem 1.5rem',
          maxWidth: '40rem',
        }}
      >
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>
          Something went wrong
        </h1>
        <p style={{ color: '#444a55', marginTop: '0.75rem' }}>
          We&apos;ve been notified. Please reload the page.
        </p>
      </body>
    </html>
  );
}
