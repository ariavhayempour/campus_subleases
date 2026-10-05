import { expect, test } from '@playwright/test';
import { removeBrowseHost, seedBrowseListings } from './helpers/browse';
import { prepareHost } from './helpers/listings';
import { signInTestUser, testUserEmail } from './helpers/sign-in';

const SCOPE = '/uw-madison?q=zebracorn';

test.afterEach(async () => {
  await removeBrowseHost();
});

test('visitors filter and sort listings, and the unit never reaches the page', async ({ page }) => {
  await seedBrowseListings([
    { title: 'Zebracorn budget room', rentCents: 60_000, unit: 'ZQ-41' },
    { title: 'Zebracorn deluxe loft', rentCents: 180_000 },
  ]);
  const response = await page.goto(SCOPE);
  expect(await response?.text()).not.toContain('ZQ-41');
  await expect(page.getByText('2 listings', { exact: true })).toBeVisible();

  const titles = page.getByRole('article').getByRole('heading', { level: 3 });
  await page.getByLabel('Sort by').selectOption('rent_desc');
  await expect(page).toHaveURL(/sort=rent_desc/);
  await expect(titles).toHaveText(['Zebracorn deluxe loft', 'Zebracorn budget room']);
  await page.getByLabel('Sort by').selectOption('rent_asc');
  await expect(titles).toHaveText(['Zebracorn budget room', 'Zebracorn deluxe loft']);

  await page.getByText('More filters').click();
  await page.getByLabel('Max rent ($)').fill('1000');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page).toHaveURL(/rentMax=1000/);
  await expect(page.getByText('1 listing', { exact: true })).toBeVisible();
  await expect(titles).toHaveText(['Zebracorn budget room']);

  await page.getByRole('link', { name: /Zebracorn budget room/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Zebracorn budget room' }),
  ).toBeVisible();
  await expect(page.getByText('ZQ-41')).toHaveCount(0);
});

test('signed-out visitors are sent to sign in when saving', async ({ page }) => {
  await seedBrowseListings([{ title: 'Zebracorn cozy studio', rentCents: 90_000 }]);
  await page.goto(SCOPE);
  await page.getByRole('article').getByRole('button', { name: 'Save listing' }).click();
  await expect(page).toHaveURL(/\/sign-in/);
});

test('"Load more" appends the next page', async ({ page }) => {
  await seedBrowseListings(
    Array.from({ length: 25 }, (_, i) => ({
      title: `Zebracorn studio ${i + 1}`,
      rentCents: 80_000 + i * 100,
    })),
  );
  await page.goto(SCOPE);
  await expect(page.getByText('25 listings', { exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(24);
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.getByRole('article')).toHaveCount(25);
  await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);
});

test('a signed-in student saves a listing and unsaves it from Saved', async ({ page }) => {
  test.skip(!testUserEmail && !process.env.CI, 'E2E Clerk test user not configured');
  expect(testUserEmail, 'E2E_CLERK_USER_EMAIL must be set in CI').not.toBe('');

  await seedBrowseListings([{ title: 'Zebracorn saved studio', rentCents: 90_000 }]);
  const userId = await signInTestUser(page);
  await page.goto('/'); // lazily creates the users row if an earlier test deleted it
  await prepareHost(userId, 'uw-madison');

  await page.goto(SCOPE);
  const save = page
    .getByRole('article')
    .filter({ hasText: 'Zebracorn saved studio' })
    .getByRole('button', { name: 'Save listing' });
  await save.click();
  await expect(save).toHaveAttribute('aria-pressed', 'true');
  await expect(save).toBeEnabled(); // the server action has finished

  await page.goto('/me/favorites');
  const saved = page.getByRole('article').filter({ hasText: 'Zebracorn saved studio' });
  await expect(saved).toBeVisible();
  await saved.getByRole('button', { name: 'Save listing' }).click();
  await expect(saved).toHaveCount(0);
});
