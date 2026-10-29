import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test, type BrowserContext } from '@playwright/test';
import { SAFETY_NOTICE } from '../lib/messaging-options';
import { removeBrowseHost, seedBrowseListings } from './helpers/browse';
import { approveListing, prepareHost, removeListings, seedListing } from './helpers/listings';
import { resetMessaging } from './helpers/messaging';
import { secondUserEmail, signInTestUser, testUserEmail } from './helpers/sign-in';

const RENTER_MESSAGE = '<b>bold?</b> Is this still available?';
const HOST_REPLY = 'Yes — want to see it Saturday?';

let hostId = '';
let renterId = '';
let contexts: BrowserContext[] = [];

test.afterEach(async () => {
  const userIds = [hostId, renterId].filter(Boolean);
  const owned = hostId;
  const open = contexts;
  hostId = '';
  renterId = '';
  contexts = [];
  // Independent steps so one failure cannot skip the rest; failures are still reported.
  const results = await Promise.allSettled([
    ...open.map((context) => context.close()),
    userIds.length > 0 ? resetMessaging(userIds) : Promise.resolve(),
    owned ? removeListings(owned) : Promise.resolve(),
    removeBrowseHost(),
  ]);
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((f) => f.reason),
      'cleanup failed',
    );
  }
});

test('signed-out visitors are sent to sign in when messaging a host', async ({ page }) => {
  await seedBrowseListings([{ title: 'Zebracorn message studio', rentCents: 90_000 }]);
  await page.goto('/uw-madison?q=zebracorn');
  await page.getByRole('link', { name: /Zebracorn message studio/ }).click();
  await page.getByRole('button', { name: 'Message host' }).click();
  await expect(page).toHaveURL(/\/sign-in/);
});

test('a renter messages a host, they reply live, and the host blocks the renter', async ({
  browser,
}) => {
  test.skip((!testUserEmail || !secondUserEmail) && !process.env.CI, 'E2E Clerk users not set');
  test.setTimeout(90_000); // two sign-ins plus a multi-page flow exceed the 30s default
  expect(testUserEmail, 'E2E_CLERK_USER_EMAIL must be set in CI').not.toBe('');
  expect(secondUserEmail, 'E2E_CLERK_USER2_EMAIL must be set in CI').not.toBe('');

  const hostContext = await browser.newContext();
  const renterContext = await browser.newContext();
  contexts = [hostContext, renterContext];
  const hostPage = await hostContext.newPage();
  const renterPage = await renterContext.newPage();
  await setupClerkTestingToken({ page: hostPage });
  await setupClerkTestingToken({ page: renterPage });
  hostId = await signInTestUser(hostPage, testUserEmail);
  renterId = await signInTestUser(renterPage, secondUserEmail);
  // Visiting a page lazily creates each users row.
  await hostPage.goto('/');
  await renterPage.goto('/');
  await prepareHost(hostId, 'uw-madison');
  await prepareHost(renterId, 'uw-madison');
  await resetMessaging([hostId, renterId]);
  await removeListings(hostId);
  const listingId = await seedListing(hostId, 'uw-madison', 'Zebracorn sublet with balcony');
  await approveListing(listingId);

  // The host waits on a non-message page so the unread badge must arrive live.
  await hostPage.goto('/me/listings');

  await renterPage.goto('/uw-madison?q=zebracorn');
  await renterPage.getByRole('link', { name: /Zebracorn sublet with balcony/ }).click();
  await expect(
    renterPage.getByRole('heading', { level: 1, name: 'Zebracorn sublet with balcony' }),
  ).toBeVisible();
  await expect(renterPage.getByText('Unit 4B')).toHaveCount(0);
  await renterPage.getByRole('link', { name: 'Message host' }).click();
  await expect(renterPage).toHaveURL(/\/messages\/new\?listing=/);
  await expect(renterPage.getByText(SAFETY_NOTICE)).toBeVisible();

  await renterPage.getByRole('textbox', { name: 'Message' }).fill(RENTER_MESSAGE);
  await renterPage.getByRole('textbox', { name: 'Message' }).press('Enter');
  await expect(renterPage).toHaveURL(/\/messages\/[0-9a-f-]{36}$/);
  const renterLog = renterPage.getByRole('log', { name: 'Messages' });
  await expect(renterLog).toContainText(RENTER_MESSAGE);
  await expect(renterPage.locator('main header').filter({ hasText: 'Unit 4B' })).toBeVisible();

  await expect(hostPage.getByRole('link', { name: 'Messages, 1 unread' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(hostPage).toHaveTitle(/^\(1\) /);

  await hostPage.getByRole('link', { name: 'Messages, 1 unread' }).click();
  await hostPage.getByRole('navigation', { name: 'Conversations' }).getByRole('link').click();
  await expect(hostPage.getByRole('log', { name: 'Messages' })).toContainText(RENTER_MESSAGE);
  await expect(hostPage.getByRole('link', { name: 'Messages', exact: true })).toBeVisible();

  await hostPage.getByRole('textbox', { name: 'Message' }).fill(HOST_REPLY);
  await hostPage.getByRole('textbox', { name: 'Message' }).press('Enter');
  await expect(renterLog).toContainText(HOST_REPLY, { timeout: 15_000 });

  await hostPage.locator('summary').filter({ hasText: 'Conversation options' }).click();
  await hostPage.getByRole('button', { name: 'Block user' }).click();
  await expect(hostPage.getByText('You blocked this user')).toBeVisible();
  await expect(hostPage.getByRole('textbox', { name: 'Message' })).toHaveCount(0);

  await renterPage.reload();
  await expect(renterPage.getByText("You can't reply to this conversation")).toBeVisible();
  await expect(renterLog).toContainText(RENTER_MESSAGE);
  await expect(renterLog).toContainText(HOST_REPLY);
  await expect(renterPage.getByRole('textbox', { name: 'Message' })).toHaveCount(0);

  await hostPage.getByRole('button', { name: 'Unblock' }).click();
  await expect(hostPage.getByRole('textbox', { name: 'Message' })).toBeVisible();
  await renterPage.reload();
  await expect(renterPage.getByRole('textbox', { name: 'Message' })).toBeVisible();
});
