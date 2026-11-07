import { expect, test, type Page } from '@playwright/test';
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

// Stands in for hCaptcha: issues a token on render and a fresh one after every reset.
const HCAPTCHA_STUB = `
  window.__hcaptchaResets = 0;
  window.__hcaptchaRemoved = 0;
  window.hcaptcha = {
    render(container, options) {
      window.__hcaptchaOptions = options;
      setTimeout(() => options.callback('e2e-captcha-token-0'), 0);
      return 'e2e-widget';
    },
    reset() {
      window.__hcaptchaResets += 1;
      const token = 'e2e-captcha-token-' + window.__hcaptchaResets;
      setTimeout(() => window.__hcaptchaOptions.callback(token), 0);
    },
    remove() {
      window.__hcaptchaRemoved += 1;
    },
  };
  window.onHCaptchaLoad();
`;

// The unsolved variant renders the widget but never issues a token.
async function stubHCaptcha(page: Page, { solved = true } = {}): Promise<void> {
  const body = solved
    ? HCAPTCHA_STUB
    : 'window.hcaptcha = { render: () => "w", reset() {} }; window.onHCaptchaLoad();';
  await page.route('https://js.hcaptcha.com/**', (route) =>
    route.fulfill({ contentType: 'application/javascript', body }),
  );
}

async function fillContactForm(page: Page): Promise<void> {
  await page.getByLabel('Name').fill('Ada L.');
  await page.getByLabel('Email').fill('ada@example.edu');
  await page.getByLabel('Message').fill('How long does listing review take?');
}

test('the contact form validates, then sends through Web3Forms', async ({ page }) => {
  const sent: unknown[] = [];
  await page.route(WEB3FORMS_ENDPOINT, async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ json: { success: true, message: 'Email sent successfully!' } });
  });
  await stubHCaptcha(page);

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
      'h-captcha-response': 'e2e-captcha-token-0',
    }),
  ]);
});

test('the contact form shows an error and keeps the text when sending fails', async ({ page }) => {
  const tokens: unknown[] = [];
  await page.route(WEB3FORMS_ENDPOINT, (route) => {
    tokens.push((route.request().postDataJSON() as Record<string, unknown>)['h-captcha-response']);
    return route.fulfill({ status: 400, json: { success: false, message: 'Invalid access key' } });
  });
  await stubHCaptcha(page);

  await page.goto('/contact');
  await fillContactForm(page);
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(
    page.getByText('Your message could not be sent. Please try again in a few minutes.'),
  ).toBeVisible();
  await expect(page.getByLabel('Message')).toHaveValue('How long does listing review take?');

  // A retry must use a fresh token, never resend the single-use one.
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __hcaptchaResets: number }).__hcaptchaResets),
    )
    .toBe(1);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(() => tokens).toEqual(['e2e-captcha-token-0', 'e2e-captcha-token-1']);
});

test('a second contact message within a minute is refused', async ({ page }) => {
  let sends = 0;
  await page.route(WEB3FORMS_ENDPOINT, (route) => {
    sends += 1;
    return route.fulfill({ json: { success: true, message: 'Email sent successfully!' } });
  });
  await stubHCaptcha(page);

  await page.goto('/contact');
  await fillContactForm(page);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Thanks, your message was sent.')).toBeVisible();

  await page.getByRole('button', { name: 'Send another message' }).click();
  await fillContactForm(page);
  // The remounted widget starts fresh: the old one is removed, the new one is not reset.
  const counters = () =>
    page.evaluate(() => {
      const w = window as unknown as { __hcaptchaResets: number; __hcaptchaRemoved: number };
      return { resets: w.__hcaptchaResets, removed: w.__hcaptchaRemoved };
    });
  // Dev mode mounts effects twice, so removals can exceed one there.
  await expect.poll(async () => (await counters()).removed).toBeGreaterThanOrEqual(1);
  expect((await counters()).resets).toBe(0);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(
    page.getByText('Please wait a minute before sending another message.'),
  ).toBeVisible();
  expect(sends).toBe(1);
});

test('the contact form refuses to send before the check is completed', async ({ page }) => {
  let sends = 0;
  await page.route(WEB3FORMS_ENDPOINT, (route) => {
    sends += 1;
    return route.fulfill({ json: { success: true } });
  });
  await stubHCaptcha(page, { solved: false });

  await page.goto('/contact');
  await fillContactForm(page);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Complete the check above to send your message.')).toBeVisible();
  expect(sends).toBe(0);
});
