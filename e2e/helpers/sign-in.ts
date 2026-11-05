import { clerk } from '@clerk/testing/playwright';
import { expect, type Locator, type Page } from '@playwright/test';

export const testUserEmail = process.env.E2E_CLERK_USER_EMAIL ?? '';

export const secondUserEmail = process.env.E2E_CLERK_USER2_EMAIL ?? '';

export const adminUserEmail = process.env.E2E_CLERK_ADMIN_EMAIL ?? '';

export async function signInTestUser(page: Page, email: string = testUserEmail): Promise<string> {
  await page.goto('/'); // Clerk loads here without a mounted <SignIn /> racing its own redirect
  // Email code (fixed for +clerk_test addresses) avoids Client Trust's new-device check on password sign-in.
  await clerk.signIn({ page, signInParams: { strategy: 'email_code', identifier: email } });
  const userId = await page.evaluate(() => window.Clerk?.user?.id ?? '');
  expect(userId).not.toBe('');
  return userId;
}

// Attribute first so copy changes don't break it; the accessible-name fallback covers markup changes.
function clerkControl(primary: Locator, fallback: Locator): Locator {
  return primary.or(fallback).first();
}

// Clerk renders a data-localization-key attribute on every localized element.
function localized(page: Page, key: string): Locator {
  return page.locator(`[data-localization-key="${key}"]`);
}

// Fills Clerk's own form on the current /sign-in page, so Clerk performs the return redirect.
export async function signInThroughForm(page: Page): Promise<void> {
  const identifier = page.locator('input[name="identifier"]');
  await clerkControl(identifier, page.getByLabel('Email address')).fill(testUserEmail);
  // Clerk's form also holds a hidden aria-hidden submit button for Enter-to-submit.
  const continueButton = page
    .locator('form')
    .filter({ has: identifier })
    .locator('button[type="submit"]:not([aria-hidden="true"])');
  await clerkControl(
    continueButton,
    page.getByRole('button', { name: 'Continue', exact: true }),
  ).click();
  await clerkControl(
    localized(page, 'signIn.password.actionLink'),
    page.getByRole('link', { name: 'Use another method' }),
  ).click();
  // Typing before Clerk has issued the code fails with "send a verification code" first.
  const codeIssued = page.waitForResponse(
    (response) => response.url().includes('prepare_first_factor') && response.ok(),
  );
  await clerkControl(
    page.locator('button', {
      has: localized(page, 'signIn.alternativeMethods.blockButton__emailCode'),
    }),
    page.getByRole('button', { name: /^Email code to/ }),
  ).click();
  await codeIssued;
  await clerkControl(
    page.locator('input[autocomplete="one-time-code"]'),
    page.getByRole('textbox', { name: 'Enter verification code' }),
  ).click();
  await page.keyboard.type('424242'); // fixed code for +clerk_test addresses
}
