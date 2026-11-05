import { expect, test } from '@playwright/test';
import { WEB3FORMS_ACCESS_KEY, WEB3FORMS_ENDPOINT } from '../lib/contact';

const PAGES = [
  { path: '/about', heading: /^About / },
  { path: '/terms', heading: 'Terms of Use' },
  { path: '/privacy', heading: 'Privacy Policy' },
  { path: '/contact', heading: 'Contact us' },
];

test('static pages render and are linked from the footer', async ({ page }) => {
  for (const { path, heading } of PAGES) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
  await page.goto('/');
  const footer = page.getByRole('navigation', { name: 'Footer' });
  await footer.getByRole('link', { name: 'Privacy' }).click();
  await expect(page).toHaveURL('/privacy');
});

test('robots.txt and sitemap.xml are served', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /messages/');
  expect(robots).toMatch(/Sitemap: .+\/sitemap\.xml/);

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.headers()['content-type']).toContain('xml');
  const xml = await sitemap.text();
  expect(xml).toContain('/umich</loc>');
  expect(xml).toContain('/privacy</loc>');
  expect(xml).not.toContain('/listings/');
});

test('the contact form validates, then sends through Web3Forms', async ({ page }) => {
  const sent: unknown[] = [];
  await page.route(WEB3FORMS_ENDPOINT, async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ json: { success: true, message: 'Email sent successfully!' } });
  });

  await page.goto('/contact');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Enter your name')).toBeVisible();
  await expect(page.getByText('Write at least 10 characters')).toBeVisible();

  await page.getByLabel('Name').fill('Ada L.');
  await page.getByLabel('Email').fill('ada@example.edu');
  await page.getByLabel('Message').fill('How long does listing review take?');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('Thanks, your message was sent.')).toBeVisible();
  await expect(page.getByText('We will reply to ada@example.edu.')).toBeVisible();
  expect(sent).toEqual([
    expect.objectContaining({
      access_key: WEB3FORMS_ACCESS_KEY,
      name: 'Ada L.',
      email: 'ada@example.edu',
      message: 'How long does listing review take?',
    }),
  ]);
});

test('the contact form shows an error and keeps the text when sending fails', async ({ page }) => {
  await page.route(WEB3FORMS_ENDPOINT, (route) =>
    route.fulfill({ status: 400, json: { success: false, message: 'Invalid access key' } }),
  );

  await page.goto('/contact');
  await page.getByLabel('Name').fill('Ada L.');
  await page.getByLabel('Email').fill('ada@example.edu');
  await page.getByLabel('Message').fill('How long does listing review take?');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(
    page.getByText('Your message could not be sent. Please try again in a few minutes.'),
  ).toBeVisible();
  await expect(page.getByLabel('Message')).toHaveValue('How long does listing review take?');
});
