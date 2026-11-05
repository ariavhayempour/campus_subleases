import { randomBytes } from 'node:crypto';
import { clerkSetup } from '@clerk/testing/playwright';

export default async function globalSetup(): Promise<void> {
  // Workers inherit this; throwaway Clerk users carry it so a sweep spares other runs' users.
  process.env.E2E_RUN_ID = randomBytes(4).toString('hex');
  await clerkSetup({ publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY });
}
