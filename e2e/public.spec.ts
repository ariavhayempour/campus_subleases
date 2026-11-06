import { expect, test } from '@playwright/test';

test('a visitor lands on the home page and browses a school', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // Holds the school ribbon still.
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sublet near campus, student to student.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Create your free account' }).first(),
  ).toHaveAttribute('href', '/sign-up');
  await page
    .getByRole('navigation', { name: /Browse any school now/ })
    .getByRole('link', { name: /University of Michigan/ })
    .click();
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

test('a school page with a query string canonicalizes to the bare school URL', async ({
  page,
  baseURL,
}) => {
  await page.goto('/umich?q=test');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${new URL(baseURL ?? 'http://localhost:3000').origin}/umich`,
  );
});
