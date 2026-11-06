import { expect, test } from '@playwright/test';
import { resetUserById } from './helpers/reset-user';
import { signInTestUser, testUserEmail } from './helpers/sign-in';

test('a new user is sent to onboarding, then to their home school', async ({ page }) => {
  test.skip(!testUserEmail && !process.env.CI, 'E2E Clerk test user not configured');
  expect(testUserEmail, 'E2E_CLERK_USER_EMAIL must be set in CI').not.toBe('');

  const userId = await signInTestUser(page);
  await resetUserById(userId);

  await page.goto('/');
  await expect(page).toHaveURL('/onboarding');

  await page.getByRole('button', { name: 'Continue' }).click();
  const homeSchool = page.getByRole('radiogroup', { name: 'Home school' });
  await expect(homeSchool).toHaveAttribute('aria-invalid', 'true');

  await homeSchool.getByRole('radio', { name: /University of Wisconsin–Madison/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL('/uw-madison');

  await page.goto('/');
  await expect(page).toHaveURL('/uw-madison');
});
