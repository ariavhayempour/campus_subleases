import { clerk } from '@clerk/testing/playwright';
import { expect, type Page } from '@playwright/test';

export const testUserEmail = process.env.E2E_CLERK_USER_EMAIL ?? '';

export async function signInTestUser(page: Page): Promise<string> {
  await page.goto('/'); // Clerk loads here without a mounted <SignIn /> racing its own redirect
  // Email code (fixed for +clerk_test addresses) avoids Client Trust's new-device check on password sign-in.
  await clerk.signIn({ page, signInParams: { strategy: 'email_code', identifier: testUserEmail } });
  const userId = await page.evaluate(() => window.Clerk?.user?.id ?? '');
  expect(userId).not.toBe('');
  return userId;
}
