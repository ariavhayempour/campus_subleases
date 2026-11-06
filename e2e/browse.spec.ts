import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { BROWSE_BBOX, removeBrowseHost, seedBrowseListings } from './helpers/browse';
import { prepareHost } from './helpers/listings';
import { signInTestUser, signInThroughForm, testUserEmail } from './helpers/sign-in';

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

  const titles = page.getByRole('article').getByRole('heading', { level: 2 });
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

test('signed-out visitors are sent to sign up when saving', async ({ page }) => {
  await seedBrowseListings([{ title: 'Zebracorn cozy studio', rentCents: 90_000 }]);
  await page.goto(SCOPE);
  await page.getByRole('button', { name: 'Save “Zebracorn cozy studio”' }).click();
  await expect(page).toHaveURL(/\/sign-up/);
});

test('signing in from a save returns to the filtered browse page', async ({ page }) => {
  test.skip(!testUserEmail && !process.env.CI, 'E2E Clerk test user not configured');
  expect(testUserEmail, 'E2E_CLERK_USER_EMAIL must be set in CI').not.toBe('');

  await seedBrowseListings([{ title: 'Zebracorn cozy studio', rentCents: 90_000 }]);
  await setupClerkTestingToken({ page });
  await page.goto(SCOPE);
  await page.getByRole('button', { name: 'Save “Zebracorn cozy studio”' }).click();
  await expect(page).toHaveURL(/\/sign-up/);
  // Existing users switch to sign-in from the sign-up form; the return URL carries over.
  await page.getByRole('link', { name: 'Sign in', exact: true }).last().click();
  await expect(page).toHaveURL(/\/sign-in/);
  await signInThroughForm(page);
  await expect(page).toHaveURL(SCOPE);
  await expect(page.getByRole('searchbox', { name: 'Keyword' })).toHaveValue('zebracorn');
  await expect(page.getByRole('article')).toHaveCount(1);
});

const studios = Array.from({ length: 25 }, (_, i) => ({
  title: `Zebracorn studio ${i + 1}`,
  rentCents: 80_000 + i * 100,
}));

test('"Load more" appends the next page of the same search', async ({ page }) => {
  // Seeded last, so it is the oldest row: an unfiltered second page would include it.
  await seedBrowseListings([
    ...studios,
    { title: 'Plain attic room', rentCents: 70_000, description: 'Quiet room with a skylight.' },
  ]);
  await page.goto(SCOPE);
  await expect(page.getByText('25 listings', { exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(24);
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.getByRole('article')).toHaveCount(25);
  await expect(page.getByRole('article').last().getByRole('heading', { level: 2 })).toHaveText(
    'Zebracorn studio 25',
  );
  await expect(page.getByText('Plain attic room')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);
});

test('going back from a listing restores the loaded cards', async ({ page }) => {
  await seedBrowseListings(studios);
  await page.goto(SCOPE);
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.getByRole('article')).toHaveCount(25);
  await page.getByRole('link', { name: /Zebracorn studio 25/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Zebracorn studio 25' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(SCOPE);
  await expect(page.getByRole('article')).toHaveCount(25);
});

test('a signed-in student saves a listing and unsaves it from Saved', async ({ page }) => {
  test.skip(!testUserEmail && !process.env.CI, 'E2E Clerk test user not configured');
  expect(testUserEmail, 'E2E_CLERK_USER_EMAIL must be set in CI').not.toBe('');

  await seedBrowseListings([{ title: 'Zebracorn saved studio', rentCents: 90_000 }]);
  const userId = await signInTestUser(page);
  await page.goto('/'); // lazily creates the users row if an earlier test deleted it
  await prepareHost(userId, 'uw-madison');

  await page.goto(SCOPE);
  const tile = page.getByRole('article').filter({ hasText: 'Zebracorn saved studio' });
  await tile.getByRole('button', { name: 'Save “Zebracorn saved studio”' }).click();
  const remove = tile.getByRole('button', { name: 'Remove “Zebracorn saved studio” from saved' });
  await expect(remove).toBeEnabled(); // the server action has finished

  await page.goto('/me/favorites');
  const saved = page.getByRole('article').filter({ hasText: 'Zebracorn saved studio' });
  await expect(saved).toBeVisible();
  await saved.getByRole('button', { name: 'Remove “Zebracorn saved studio” from saved' }).click();
  await expect(saved).toHaveCount(0);
});

test('tile hearts are named per listing', async ({ page }) => {
  await seedBrowseListings([{ title: 'Zebracorn named studio', rentCents: 90_000 }]);
  await page.goto(SCOPE);
  await expect(
    page.getByRole('article').getByRole('button', { name: 'Save “Zebracorn named studio”' }),
  ).toBeVisible();
});

// Without a Mapbox token (CI) the map pane shows "Map unavailable" instead of a map.
const mapPane = (page: Page): Locator =>
  page.locator('.mapboxgl-map').or(page.getByText('Map unavailable'));

test('the desktop map stays mounted when the window narrows to phone width', async ({ page }) => {
  await seedBrowseListings([{ title: 'Zebracorn resize studio', rentCents: 90_000 }]);
  await page.goto(SCOPE);
  await expect(mapPane(page)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Show map' })).toBeVisible();
  await expect(mapPane(page)).toHaveCount(1);
});

test.describe('at phone width', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('phone does not load the map until Show map', async ({ page }) => {
    await seedBrowseListings([{ title: 'Zebracorn phone studio', rentCents: 90_000 }]);
    await page.goto(SCOPE);
    await expect(page.getByRole('article')).toHaveCount(1);
    await page.waitForLoadState('networkidle');
    await expect(mapPane(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Show map' }).click();
    await expect(mapPane(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show list' })).toBeVisible();
  });

  test('phone opens a bbox link on the map', async ({ page }) => {
    await seedBrowseListings([{ title: 'Zebracorn phone studio', rentCents: 90_000 }]);
    await page.goto(`${SCOPE}&bbox=${BROWSE_BBOX}`);
    await expect(mapPane(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show list' })).toBeVisible();
  });
});
