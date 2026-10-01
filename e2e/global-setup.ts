import { clerkSetup } from '@clerk/testing/playwright';

export default async function globalSetup(): Promise<void> {
  await clerkSetup({ publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY });
}
