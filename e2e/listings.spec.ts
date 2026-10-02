import { expect, test } from '@playwright/test';
import { approveListing, prepareHost, removeListings, seedListing } from './helpers/listings';
import { signInTestUser, testUserEmail } from './helpers/sign-in';

const TITLE = 'E2E sunny studio';

test('an owner sees a pending listing; once approved it is public without the unit', async ({
  page,
  browser,
}) => {
  test.skip(!testUserEmail && !process.env.CI, 'E2E Clerk test user not configured');
  expect(testUserEmail, 'E2E_CLERK_USER_EMAIL must be set in CI').not.toBe('');

  const userId = await signInTestUser(page);
  try {
    await page.goto('/'); // lazily creates the users row if an earlier test deleted it
    await prepareHost(userId, 'uw-madison');
    const listingId = await seedListing(userId, 'uw-madison', TITLE);
    const listingUrl = `/uw-madison/listings/${listingId}`;

    await page.goto('/me/listings');
    const row = page.getByRole('listitem').filter({ hasText: TITLE });
    await expect(row.getByText('Pending review', { exact: true })).toBeVisible();

    await page.goto(`/listings/${listingId}/edit`);
    await expect(page.getByLabel('Which school is this near?')).toBeDisabled();
    await expect(page.getByLabel('Type', { exact: true })).toBeDisabled();
    await expect(
      page.getByText('To change this, delete the listing and post a new one.'),
    ).toHaveCount(2);

    await page.goto(listingUrl);
    await expect(page.getByRole('heading', { name: TITLE })).toBeVisible();
    await expect(page.getByText('123 State St, Unit 4B')).toBeVisible();
    await expect(page.getByText('can see this page right now')).toBeVisible();

    const visitorContext = await browser.newContext();
    try {
      const visitor = await visitorContext.newPage();
      const hidden = await visitor.goto(listingUrl);
      expect(hidden?.status()).toBe(404);

      await approveListing(listingId);
      const live = await visitor.goto(listingUrl);
      expect(live?.status()).toBe(200);
      expect(await live?.text()).not.toContain('Unit 4B');
      await expect(visitor.getByRole('heading', { name: TITLE })).toBeVisible();
      await expect(visitor.getByText('123 State St', { exact: true })).toBeVisible();
      await expect(visitor.getByText('Unit 4B')).toHaveCount(0);
    } finally {
      await visitorContext.close();
    }

    await page.goto('/me/listings');
    await expect(row.getByText('Live', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: 'Mark as taken' }).click();
    await expect(row.getByText('Taken', { exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Reactivate' })).toBeVisible();
  } finally {
    await removeListings(userId);
  }
});
