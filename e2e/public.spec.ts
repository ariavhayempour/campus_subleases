import { expect, test } from '@playwright/test';

test('a visitor picks a school and sees its page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Find a sublease near campus' })).toBeVisible();
  await page.getByRole('link', { name: 'University of Michigan' }).click();
  await expect(page).toHaveURL('/umich');
  await expect(
    page.getByRole('heading', { name: 'Subleases near University of Michigan' }),
  ).toBeVisible();
});

test('unknown school slugs 404', async ({ page }) => {
  const response = await page.goto('/not-a-school');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
