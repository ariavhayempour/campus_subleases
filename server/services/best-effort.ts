import * as Sentry from '@sentry/nextjs';

// Storage cleanup must never mask the real outcome; leftovers are swept by a later job.
export async function bestEffort(cleanup: () => Promise<void>): Promise<void> {
  try {
    await cleanup();
  } catch (error) {
    Sentry.captureException(error);
  }
}
