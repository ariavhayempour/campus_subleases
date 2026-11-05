import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  approveListing,
  prepareHost,
  removeAudit,
  removeListings,
  seedListing,
} from './helpers/listings';
import {
  createThrowawayUser,
  deleteThrowawayUser,
  getClerkUser,
  removeReports,
  sweepThrowawayUsers,
} from './helpers/moderation';
import { adminUserEmail, secondUserEmail, signInTestUser, testUserEmail } from './helpers/sign-in';

const REJECT_NOTE = 'Photos do not match the address';
const SLOW = { timeout: 20_000 };

let hostId = '';
let seededIds: string[] = [];
let throwawayId = '';
let contexts: BrowserContext[] = [];

// The sweep logs its own failures, so a Clerk outage cannot fail every test here.
test.beforeAll(async () => {
  if (process.env.CLERK_SECRET_KEY) await sweepThrowawayUsers();
});

test.afterEach(async () => {
  const owned = hostId;
  const ids = seededIds;
  const throwaway = throwawayId;
  const open = contexts;
  hostId = '';
  seededIds = [];
  throwawayId = '';
  contexts = [];
  // Independent steps so one failure cannot skip the rest; failures are still reported.
  const results = await Promise.allSettled([
    ...open.map((context) => context.close()),
    removeAudit(ids),
    removeReports(throwaway ? [...ids, throwaway] : ids),
    throwaway ? deleteThrowawayUser(throwaway) : Promise.resolve(),
    owned ? removeListings(owned) : Promise.resolve(),
  ]);
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failures.length > 0) {
    const reasons = failures.map((f) => f.reason as unknown);
    // A bare AggregateError reports only its own message, hiding which steps failed.
    const messages = reasons.map((r) => (r instanceof Error ? r.message : String(r)));
    throw new Error(`cleanup failed: ${messages.join('; ')}`, {
      cause: new AggregateError(reasons, 'cleanup failed'),
    });
  }
});

async function signIn(browser: Browser, email: string) {
  const context = await browser.newContext();
  contexts.push(context);
  const page = await context.newPage();
  await setupClerkTestingToken({ page });
  const userId = await signInTestUser(page, email);
  await page.goto('/'); // Visiting a page lazily creates the users row.
  return { page, userId };
}

// LocalTime renders a blank placeholder until React hydrates; SSR buttons are already enabled.
async function waitForHydration(page: Page): Promise<void> {
  await expect(page.locator('main time').first()).toHaveText(/\S/, SLOW);
}

// Opens the listing's review page by id; the Pending tab lists only the oldest rows.
async function openAdminListing(page: Page, listingId: string, title: string): Promise<void> {
  await page.goto(`/admin/listings/${listingId}`);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible(SLOW);
  await waitForHydration(page);
}

function requireUsers() {
  test.skip((!testUserEmail || !adminUserEmail) && !process.env.CI, 'E2E Clerk users not set');
  test.setTimeout(90_000); // two sign-ins plus a multi-page flow exceed the 30s default
  expect(testUserEmail, 'E2E_CLERK_USER_EMAIL must be set in CI').not.toBe('');
  expect(adminUserEmail, 'E2E_CLERK_ADMIN_EMAIL must be set in CI').not.toBe('');
}

test('admin approves a pending listing', async ({ browser }) => {
  requireUsers();
  const host = await signIn(browser, testUserEmail);
  const admin = await signIn(browser, adminUserEmail);
  hostId = host.userId;
  await prepareHost(hostId, 'uw-madison');
  const title = 'Zebracorn approve me';
  const listingId = await seedListing(hostId, 'uw-madison', title);
  seededIds.push(listingId);

  const page = admin.page;
  await openAdminListing(page, listingId, title);
  await expect(page.getByText('Pending review', { exact: true })).toBeVisible(SLOW);
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0, SLOW);

  await page.goto('/admin/listings?tab=approved');
  await expect(page.getByRole('link', { name: title })).toBeVisible(SLOW);

  const publicContext = await browser.newContext();
  contexts.push(publicContext);
  const publicPage = await publicContext.newPage();
  await publicPage.goto(`/uw-madison/listings/${listingId}`);
  await expect(publicPage.getByRole('heading', { level: 1, name: title })).toBeVisible(SLOW);
});

test('admin rejects; the owner sees the reason, edits, and the listing is resubmitted', async ({
  browser,
}) => {
  requireUsers();
  const host = await signIn(browser, testUserEmail);
  const admin = await signIn(browser, adminUserEmail);
  hostId = host.userId;
  await prepareHost(hostId, 'uw-madison');
  const listingId = await seedListing(hostId, 'uw-madison', 'Zebracorn reject me', {
    withPhoto: true,
  });
  seededIds.push(listingId);

  const adminPage = admin.page;
  await openAdminListing(adminPage, listingId, 'Zebracorn reject me');
  await adminPage.getByLabel('Reason shown to the owner').fill(REJECT_NOTE);
  await adminPage.getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(adminPage.getByRole('button', { name: 'Approve' })).toHaveCount(0, SLOW);
  await adminPage.goto('/admin/listings?tab=rejected');
  await expect(adminPage.getByRole('link', { name: 'Zebracorn reject me' })).toBeVisible(SLOW);

  const hostPage = host.page;
  await hostPage.goto('/me/listings');
  await expect(hostPage.getByText(`Rejected: ${REJECT_NOTE}`, { exact: true })).toBeVisible(SLOW);
  await hostPage.getByRole('link', { name: 'Edit and resubmit' }).click();
  await expect(hostPage).toHaveURL(/\/edit$/, SLOW);
  await hostPage.getByLabel('Title').fill('Zebracorn resubmitted');
  await hostPage.getByRole('button', { name: 'Save changes' }).click();
  await expect(hostPage).toHaveURL(/\/me\/listings/, SLOW);
  await expect(hostPage.getByText('Pending review', { exact: true })).toBeVisible(SLOW);

  await openAdminListing(adminPage, listingId, 'Zebracorn resubmitted');
  await expect(adminPage.getByText('Pending review', { exact: true })).toBeVisible(SLOW);
  await expect(adminPage.getByRole('button', { name: 'Approve' })).toBeVisible(SLOW);
});

test('a renter reports a listing and the admin resolves it', async ({ browser }) => {
  requireUsers();
  test.skip(!secondUserEmail && !process.env.CI, 'E2E_CLERK_USER2_EMAIL not set');
  expect(secondUserEmail, 'E2E_CLERK_USER2_EMAIL must be set in CI').not.toBe('');
  const host = await signIn(browser, testUserEmail);
  const renter = await signIn(browser, secondUserEmail);
  const admin = await signIn(browser, adminUserEmail);
  hostId = host.userId;
  await prepareHost(hostId, 'uw-madison');
  const title = 'Zebracorn reported';
  const listingId = await seedListing(hostId, 'uw-madison', title);
  seededIds.push(listingId);
  await approveListing(listingId);

  const renterPage = renter.page;
  await renterPage.goto(`/uw-madison/listings/${listingId}`);
  await renterPage.getByRole('button', { name: 'Report listing' }).click();
  const dialog = renterPage.getByRole('dialog');
  await dialog.getByLabel('Scam or fraud').check(SLOW);
  await dialog.getByLabel('Anything else we should know?').fill('Asked for a deposit by wire');
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(dialog.getByText("Thanks. We'll review your report.")).toBeVisible(SLOW);
  await dialog.getByRole('button', { name: 'Close' }).click();

  await renterPage.getByRole('button', { name: 'Report listing' }).click();
  await dialog.getByLabel('Scam or fraud').check(SLOW);
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(dialog.getByText("You've already reported this. We'll review it soon.")).toBeVisible(
    SLOW,
  );

  const page = admin.page;
  await page.goto('/admin/reports');
  const row = page.getByRole('row').filter({ hasText: title });
  await row.getByRole('link', { name: 'Scam or fraud' }).click();
  await expect(page).toHaveURL(/\/admin\/reports\/[0-9a-f-]{36}$/, SLOW);
  const reportId = page.url().split('/').pop() ?? '';
  await expect(page.getByText('Asked for a deposit by wire')).toBeVisible(SLOW);
  await waitForHydration(page);
  await page.getByLabel('Resolution note').fill('Talked to the host');
  await page.getByRole('button', { name: 'Resolve', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Resolution' })).toBeVisible(SLOW);
  await expect(page.getByText('Talked to the host')).toBeVisible(SLOW);
  await expect(page.getByText(/· Resolved$/)).toBeVisible(SLOW);

  await page.goto('/admin/reports?status=open');
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible(SLOW);
  await expect(page.getByRole('row').filter({ hasText: title })).toHaveCount(0, SLOW);

  await page.goto('/admin/audit');
  const auditRow = page
    .getByRole('row')
    .filter({ hasText: `report ${reportId.slice(0, 8)}` })
    .filter({ hasText: 'Resolved report' });
  await expect(auditRow).toContainText('note: Talked to the host', SLOW);
});

test('the admin bans and unbans a user', async ({ browser }) => {
  requireUsers();
  test.skip(!process.env.CLERK_SECRET_KEY && !process.env.CI, 'CLERK_SECRET_KEY not set');
  expect(process.env.CLERK_SECRET_KEY, 'CLERK_SECRET_KEY must be set in CI').toBeTruthy();
  const admin = await signIn(browser, adminUserEmail);
  const throwaway = await createThrowawayUser();
  throwawayId = throwaway.id;

  const page = admin.page;
  await page.goto(`/admin/users/${throwaway.id}`);
  await expect(page.getByRole('heading', { level: 1, name: throwaway.displayName })).toBeVisible(
    SLOW,
  );
  await expect(page.getByText('Active', { exact: true })).toBeVisible(SLOW);

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Ban user' }).click();
  await expect(page.getByText('Banned', { exact: true })).toBeVisible(SLOW);
  expect((await getClerkUser(throwaway.id)).banned).toBe(true);

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Unban user' }).click();
  await expect(page.getByText('Active', { exact: true })).toBeVisible(SLOW);
  expect((await getClerkUser(throwaway.id)).banned).toBe(false);
});
