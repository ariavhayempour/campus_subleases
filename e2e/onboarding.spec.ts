import { clerk } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';
import { resetUserById } from './helpers/reset-user';

const email = process.env.E2E_CLERK_USER_EMAIL ?? '';

test('a new user is sent to onboarding, then to their home school', async ({ page }) => {
  test.skip(!email && !process.env.CI, 'E2E Clerk test user not configured');
  expect(email, 'E2E_CLERK_USER_EMAIL must be set in CI').not.toBe('');

  await page.goto('/sign-in');
  // Email code (fixed for +clerk_test addresses) avoids Client Trust's new-device check on password sign-in.
  await clerk.signIn({ page, signInParams: { strategy: 'email_code', identifier: email } });
  const userId = await page.evaluate(() => window.Clerk?.user?.id ?? '');
  expect(userId).not.toBe('');
  await resetUserById(userId);

  await page.goto('/');
  await expect(page).toHaveURL('/onboarding');

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByLabel('Home school')).toHaveAttribute('aria-invalid', 'true');

  await page.getByLabel('Home school').selectOption({ label: 'University of Wisconsin–Madison' });
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL('/uw-madison');

  await page.goto('/');
  await expect(page).toHaveURL('/uw-madison');
});
