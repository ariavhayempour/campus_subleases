import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  // Scripts injected by in-app browsers (e.g. Snapchat on iOS), not our code.
  ignoreErrors: ['SCDynimacBridge'],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
