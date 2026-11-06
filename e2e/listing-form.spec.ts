import { expect, test } from '@playwright/test';
import { prepareHost, removeListings } from './helpers/listings';
import { signInTestUser, testUserEmail } from './helpers/sign-in';

test('the listing form reveals each group in order and swaps amenities by property type', async ({
  page,
}) => {
  test.skip(!testUserEmail && !process.env.CI, 'E2E Clerk test user not configured');
  expect(testUserEmail, 'E2E_CLERK_USER_EMAIL must be set in CI').not.toBe('');

  const userId = await signInTestUser(page);
  try {
    await page.goto('/'); // lazily creates the users row
    await prepareHost(userId, 'uw-madison');
    await page.goto('/listings/new');

    const type = page.getByLabel('Is it an apartment or a house?');
    const bedrooms = page.getByLabel('Bedrooms (0 = studio)');
    const gender = page.getByLabel('Gender preference');
    const roomType = page.getByLabel('Room type');
    await expect(type).toBeVisible();
    await expect(bedrooms).toHaveCount(0);

    await type.selectOption('house');
    await expect(bedrooms).toBeVisible();
    await expect(gender).toHaveCount(0);

    await bedrooms.fill('3');
    await page.getByLabel('Bathrooms').fill('2');
    await page.getByLabel('Roommates').selectOption('0');
    await expect(page.getByLabel('Roommates').locator('option:checked')).toHaveText('No roommates');
    await expect(gender).toBeVisible();
    await expect(roomType).toHaveCount(0);

    await gender.selectOption('any');
    await expect(roomType).toBeVisible();
    await expect(page.getByLabel('Private bathroom?')).toHaveCount(0);
    await expect(page.getByLabel('Garage')).toHaveCount(0);

    await roomType.selectOption('single');
    await expect(page.getByText('House amenities')).toBeVisible();
    await expect(page.getByLabel('Garage')).toBeVisible();
    await expect(page.getByLabel('Gym')).toHaveCount(0);

    await type.selectOption('apartment');
    await expect(page.getByText('Apartment and building amenities')).toBeVisible();
    await expect(page.getByLabel('Gym')).toBeVisible();
    await expect(page.getByLabel('Garage')).toHaveCount(0);

    await page.getByLabel('Roommates').selectOption('2');
    await expect(page.getByLabel('Private bathroom?')).toBeVisible();
  } finally {
    await removeListings(userId);
  }
});
