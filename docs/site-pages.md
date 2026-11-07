# Site pages, footer, and search-engine files

Public static pages, the site footer, the contact form, and `robots.txt` / `sitemap.xml`.

## Pages

| Route      | File                   | Notes                                            |
| ---------- | ---------------------- | ------------------------------------------------ |
| `/about`   | `app/about/page.tsx`   | How the site works, safety tips, non-affiliation |
| `/terms`   | `app/terms/page.tsx`   | Terms of Use; dated "Last updated"               |
| `/privacy` | `app/privacy/page.tsx` | Privacy Policy; dated "Last updated"             |
| `/contact` | `app/contact/page.tsx` | Web3Forms contact form (`contact-form.tsx`)      |

All four are public and indexable. They render per request, because the root layout reads the
request path to pick the school colors (see `design-system.md`). They share `app/_components/static-page.tsx` (title,
optional "Last updated" line, and prose styling for `h2`, `p`, `ul`, `a`). The slugs are already
in `lib/reserved-slugs.ts`, so no school can take them.

**Policy copy** covers what the spec requires the Terms and Privacy Policy to disclose, and the
owner chose an 18+ minimum age. The copy is a plain-language draft, not legal advice: have it
reviewed before launch, and update the "Last updated" date with every change. When behaviour changes
(what is stored, who sees it, what deletion removes, which providers are used), update
`app/privacy/page.tsx` in the same PR. The safety tip and the "Deleted user" label are read from
`lib/messaging-options.ts` so they match the messaging UI.

## Canonical URLs

The root layout sets `metadataBase` from `siteUrl()`, so relative metadata URLs
(such as canonical) resolve to absolute ones, and Next does not warn at build about a missing
`metadataBase`. `/`, the four static pages, and
`/{school}` each set `alternates.canonical` to their own path; `/{school}` drops the query string,
so filtered views do not compete with the bare browse page. Tested in `tests/app/canonical.test.ts`
and `e2e/public.spec.ts`.

## Footer

`app/_components/site-footer.tsx` is mounted in the root layout after the page and pinned to the
bottom with `mt-auto` (the body is a flex column). It links the four pages and states the site is
free, student-only, and not affiliated with any university.

It renders nothing on `/messages` and `/messages/*`: that screen is sized to exactly the viewport
below the header and its stripe (`h-[calc(100dvh-4.5rem)]`), so a footer would make the whole page scroll. That is
why the footer is a client component (`usePathname`).

## Contact form (Web3Forms)

The spec planned a `mailto:` link because a form "would need email sending". The owner chose
[Web3Forms](https://docs.web3forms.com) instead: the browser posts JSON to
`https://api.web3forms.com/submit`, and Web3Forms emails the message to the address tied to the
access key. No server code, dependency, or environment variable is involved.

- **Browser-only.** Web3Forms' free plan rejects server-side submissions, so `submitContactMessage`
  (`lib/contact.ts`) runs in the client component. The access key is therefore public by design;
  it is the `WEB3FORMS_ACCESS_KEY` constant in `lib/contact.ts`, the same in every environment
  (so local and preview submissions also reach the owner's inbox). Messages go to the email the key
  was created with; change that in the Web3Forms dashboard, or swap the key. With an empty key the
  form refuses to send and says it is not set up.
- **Validation:** `lib/validation/contact.ts` (name 1–100, email, message 10–5,000; all
  trimmed),
  used by the form through `zodResolver`.
- **Payload:** `access_key`, `h-captcha-response`, a fixed `subject` and `from_name` naming
  `APP_NAME`, and the visitor's `name`, `email` (Web3Forms uses it as reply-to), and `message`.
- **Spam:**
  - **hCaptcha** (`app/contact/hcaptcha-widget.tsx`): loaded from `js.hcaptcha.com` with
    `render=explicit&onload=onHCaptchaLoad` (no npm package) and rendered with Web3Forms' free
    sitekey (`HCAPTCHA_SITEKEY`). Web3Forms verifies the token only once hCaptcha is enabled for
    the form in its dashboard (see `launch-checklist.md`). Tokens are single-use: the widget resets
    after every send attempt. Sending without a token shows "Complete the check above to send your
    message."
  - **Cooldown** (`lib/contact-cooldown.ts`): after a successful send, another send within 60
    seconds shows "Please wait a minute before sending another message." It lives in
    `localStorage`, so it only deters casual resubmits; with storage unavailable there is none.
  - **Honeypot:** a hidden `botcheck` checkbox. If it is ticked, the form shows success without
    sending.
- **Local development:** hCaptcha refuses `localhost`. To try the real form, open
  `http://127.0.0.1:3000/contact` (`next.config.ts` allows that dev origin). E2E stubs the
  hCaptcha script instead.
- **Failures:** network errors, HTTP 429, non-JSON responses, and `success: false` all show an
  inline error; the form keeps what was typed.
- **Privacy:** Web3Forms and hCaptcha are listed as providers in the Privacy Policy.
- **Abuse reports** go through the in-app Report options, not this form; the page says so.

## robots.txt and sitemap.xml

`app/robots.ts` and `app/sitemap.ts` (Next.js metadata routes). Absolute URLs come from
`NEXT_PUBLIC_SITE_URL` through `siteUrl()` (`lib/site-url.ts`), which strips a trailing slash and
falls back to `http://localhost:3000` when unset.

- **robots.txt** allows everything except signed-in and admin routes: `/admin`, `/messages`,
  `/onboarding`, `/settings` (each as an exact `$` match plus a `/` subtree, so a future school slug
  such as `/messages-university` is not blocked), and the prefixes `/api/`, `/listings/` (create
  and edit), and `/me/`.
- **Listing pages are not disallowed.** They are kept out of search results by their `noindex` meta
  tag, and a crawler can only read that tag if it may fetch the page. Disallowing them could still
  let their bare URLs be indexed from outside links.
- **sitemap.xml** lists `/`, every active school's browse page, and the four static pages. It has
  no listing URLs. It reads schools from the database, so it is `force-dynamic` (rendered
  per request) to keep `next build` free of a database dependency.

Vercel adds `X-Robots-Tag: noindex` to every preview deployment, so the same robots file is safe in
every environment. Exception: if a custom domain (e.g. a staging subdomain) is ever assigned to a
non-production branch, Vercel omits that header and staging must add its own `noindex`.

## Tests

- `tests/lib/contact.test.ts`: schema, payload, and every failure path of `submitContactMessage`
  with a fake `fetch`.
- `tests/lib/site-url.test.ts`: `siteUrl()`.
- `tests/app/robots-sitemap.test.ts`: blocked and allowed paths (with a small robots matcher) and
  the sitemap against the seeded schools.
- `e2e/static-pages.spec.ts`: pages and footer links, robots/sitemap over HTTP, and the contact
  form with the Web3Forms request intercepted (no real email is sent) and the hCaptcha script
  stubbed: token in the payload, a fresh token after a failed send, the cooldown, and the
  unsolved check.
- `tests/lib/contact-cooldown.test.ts`: the cooldown countdown and unavailable storage.

## Landing page (`/`)

`app/page.tsx` is the signed-out landing page. Signed-in users never see it: students who still
need onboarding go to `/onboarding`, everyone else with a home school goes to `/{school}`.

Sections, top to bottom: an ink hero (headline, lede, **Create your free account** linking to
`/sign-up`, and "or look around first" jumping to the ribbon), the school ribbon, a "leaving /
looking" section with an illustrative term timeline, the three sign-up steps, the platform's
promises (students only, every listing reviewed, free, unit number private), and a closing call to
action with a "Don't see your school? Tell us" link to `/contact`. Copy states only product facts;
there are no counts or testimonials.

**School ribbon** (`app/_components/school-ribbon.tsx`) lists every active school from
`listActiveSchools()`, so new schools appear without code changes. Each block is a link to the
school's browse page, wearing that school's colors via `schoolThemeStyle`. The list is repeated
until half the row covers a 2560px screen, then the row scrolls itself sideways (32px/s) and wraps
at the halfway point, which makes the loop seamless. Only the first copy is in the accessibility
tree and tab order (repeats are `aria-hidden` with `tabIndex={-1}`, but stay clickable). Motion stops while the pointer is over
the row, while anything in it has focus, during a touch, when the tab is hidden, and when the
visitor presses **Pause**, which also pauses the hero's school lights. While paused it shows a thin scrollbar. Under `prefers-reduced-motion` it renders one copy
as a wrapping grid that shows every school, with no Pause button. It moves `scrollLeft` rather than a CSS transform, so focus
and manual scrolling bring any block into view.

**School lights and accent.** The hero draws one glow per active school (up to four) behind the
headline, colored by `schoolGlowColor` in `lib/school-theme.ts`. Everything below the hero sits in
`LandingAccent` (`app/_components/landing-accent.tsx`), which holds one chosen school (the first by
name to start) and spreads its `schoolThemeStyle` over those sections. The chips in the term example
(`app/_components/term-match.tsx`) switch it; with one school the chips are hidden.

**Reveals.** `LandingReveal` (`app/_components/landing-reveal.tsx`) finds every `[data-reveal]` block
after hydration and, for blocks still below the fold, sets `data-reveal="armed"` (the hidden start
state in `app/globals.css`), then `"in"` when the block scrolls into view. Blocks already on screen are
left alone, nothing is armed under `prefers-reduced-motion`, and without JavaScript every block simply
renders finished. The term example replays its bars on a school change by snapping to
`data-reveal="reset"` and back to `"in"`.

The header's bottom stripe is hidden on `/` for signed-out visitors so the ink header runs
straight into the ink hero (`HeaderStripe` in `app/_components/header-brand.tsx`).
