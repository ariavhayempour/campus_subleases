import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';
import { signInTestUser } from './helpers/sign-in';

const LINKS = ['Post a listing', 'Saved', 'My listings', 'Settings'];

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test('signed-in header fits a phone and collapses links into a menu', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signInTestUser(page);
  await page.goto('/');

  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: /^Messages/ })).toBeVisible();
  await expect(header.locator('.cl-userButtonTrigger')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  await header.getByText('Menu', { exact: true }).click();
  for (const name of LINKS) {
    await expect(header.getByRole('link', { name, exact: true })).toBeVisible();
  }

  await header.getByRole('link', { name: 'Saved', exact: true }).click();
  await expect(page).toHaveURL(/\/me\/favorites$/);
  await expect(header.getByRole('link', { name: 'Settings', exact: true })).toBeHidden();
  await expect(header.locator('details')).not.toHaveAttribute('open', /.*/);
});

test('signed-in header shows links inline on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signInTestUser(page);
  await page.goto('/');

  const header = page.getByRole('banner');
  for (const name of LINKS) {
    await expect(header.getByRole('link', { name, exact: true })).toBeVisible();
  }
  await expect(header.getByText('Menu', { exact: true })).toBeHidden();
});
