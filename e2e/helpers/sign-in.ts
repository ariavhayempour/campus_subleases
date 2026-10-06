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

// Fills Clerk's own form on the current /sign-in page, so Clerk performs the return redirect.
export async function signInThroughForm(page: Page): Promise<void> {
  await page.getByLabel('Email address').fill(testUserEmail);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('link', { name: 'Use another method' }).click();
  // Typing before Clerk has issued the code fails with "send a verification code" first.
  const codeIssued = page.waitForResponse(
    (response) => response.url().includes('prepare_first_factor') && response.ok(),
  );
  await page.getByRole('button', { name: /^Email code to/ }).click();
  await codeIssued;
  await page.getByRole('textbox', { name: 'Enter verification code' }).click();
  await page.keyboard.type('424242'); // fixed code for +clerk_test addresses
}
