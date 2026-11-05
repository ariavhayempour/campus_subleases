# Site pages, footer, and search-engine files

Public static pages, the site footer, the contact form, and `robots.txt` / `sitemap.xml`.

## Pages

| Route      | File                   | Notes                                            |
| ---------- | ---------------------- | ------------------------------------------------ |
| `/about`   | `app/about/page.tsx`   | How the site works, safety tips, non-affiliation |
| `/terms`   | `app/terms/page.tsx`   | Terms of Use; dated "Last updated"               |
| `/privacy` | `app/privacy/page.tsx` | Privacy Policy; dated "Last updated"             |
| `/contact` | `app/contact/page.tsx` | Web3Forms contact form (`contact-form.tsx`)      |

All four are static, public, and indexable. They share `app/_components/static-page.tsx` (title,
optional "Last updated" line, and prose styling for `h2`, `p`, `ul`, `a`). The slugs are already
in `lib/reserved-slugs.ts`, so no school can take them.

**Policy copy** covers what the spec requires the Terms and Privacy Policy to disclose, and the owner
chose an 18+ minimum age. The copy is a plain-language draft, not legal advice: have it reviewed
before launch, and update the "Last updated" date with every change. When behaviour changes
(what is stored, who sees it, what deletion removes, which providers are used), update
`app/privacy/page.tsx` in the same PR. The safety tip and the "Deleted user" label are read from
`lib/messaging-options.ts` so they match the messaging UI.

## Footer

`app/_components/site-footer.tsx` is mounted in the root layout after the page and pinned to the
bottom with `mt-auto` (the body is a flex column). It links the four pages and states the site is
free, student-only, and not affiliated with any university.

It renders nothing on `/messages` and `/messages/*`: that screen is sized to exactly the viewport
below the header (`h-[calc(100dvh-3.5rem)]`), so a footer would make the whole page scroll. That is
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
- **Validation:** `lib/validation/contact.ts` (name 1–100, email, message 10–5,000; all trimmed),
  used by the form through `zodResolver`.
- **Payload:** `access_key`, a fixed `subject` and `from_name` naming `APP_NAME`, and the visitor's
  `name`, `email` (Web3Forms uses it as reply-to), and `message`.
- **Spam:** a hidden `botcheck` checkbox. If it is ticked, the form shows success without sending.
- **Failures:** network errors, HTTP 429, non-JSON responses, and `success: false` all show an
  inline error; the form keeps what was typed.
- **Privacy:** Web3Forms is listed as a provider in the Privacy Policy.
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
  no listing URLs. It reads schools from the database, so it is `force-dynamic` (rendered per request)
  to keep `next build` free of a database dependency.

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
  form with the Web3Forms request intercepted (no real email is sent).
