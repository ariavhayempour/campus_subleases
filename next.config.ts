import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Listing photos are pre-sized WebP on Supabase's CDN; skip Vercel's optimization quota.
  images: { unoptimized: true },
  // hCaptcha refuses localhost, so the contact form is tried locally at 127.0.0.1 (dev only).
  allowedDevOrigins: ['127.0.0.1'],
};

// Source maps upload only when SENTRY_AUTH_TOKEN is set (Vercel builds); other builds skip it.
export default withSentryConfig(nextConfig, {
  org: 'ariav-hayempour',
  project: 'campus-subleases',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN, deleteSourcemapsAfterUpload: true },
  silent: !process.env.CI,
  telemetry: false,
});
