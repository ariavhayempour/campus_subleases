# Launch checklist

Settings to confirm before and right after the first production deploy. Values come from
`auth.md`, `messaging.md`, `storage.md`, and `environment.md`. Secret values are never written
here, only variable names.

## Before launch (open items)

- [ ] Owner creates a Sentry org auth token (source-map upload scope) and adds it as
      `SENTRY_AUTH_TOKEN` in Vercel Production and Preview. Not in chat or in git.
- [ ] Production Mapbox token URL-restricted (see Mapbox). TBD: the production token value and
      its URL list are not recorded in docs.
- [ ] Choose where the friend trial runs, staging or production (owner's choice at launch).
      If it runs on staging (Preview), set `NEXT_PUBLIC_SITE_URL` for that environment to its URL,
      or canonical and og:url point at localhost.
- [ ] TBD: the production Clerk instance's Frontend API domain is not recorded in docs; record
      it in the Supabase step below once known.

## Vercel

- [ ] Production domain `studentsubleases.com` added to the project; the former domain
      `campussubleases.com` (and its `www`) 308-redirects to it.
- [ ] Every variable in `environment.md` set for the right environment (Production, and
      Preview for staging): Clerk keys, `CLERK_WEBHOOK_SIGNING_SECRET`, `DATABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
      `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`.
- [ ] `NEXT_PUBLIC_SITE_URL=https://studentsubleases.com` in Production.
      Include the `https://` scheme. It is baked in at build time, so set it before the
      production build and redeploy after any change. A value without a scheme breaks every page
      (`app/layout.tsx` builds `metadataBase` from it).
- [ ] `CRON_SECRET` set. After the first production deploy, the cron for `/api/cron/cleanup`
      (daily) is visible under Project, Cron Jobs.
- [ ] `SENTRY_AUTH_TOKEN` set (Production and Preview).
- [x] Firewall rule `Per-IP rate limit` (300 requests / 60 s per IP, not `/_next/`) published
      2026-11-06 in **Log** mode (see `rate-limits.md`).
- [ ] After a few days of traffic, review the rule's traffic in Firewall. If normal visitors
      never reach 300/min, switch it to the default 429 action: Firewall → Configure → edit the
      rule → If exceeded: Default (429) → Save → Review Changes → Publish. If real users hit it,
      raise the limit instead.

## Clerk production instance

- [ ] Email + password sign-up; first and last name required; no usernames.
- [ ] Email verification code required.
- [ ] Bot protection on (sign-up CAPTCHA), so scripted sign-ups can't burn monthly active users.
- [ ] Owner has `publicMetadata.role = "admin"`.
- [ ] Webhook endpoint `https://studentsubleases.com/api/webhooks/clerk` subscribed to
      `user.created`, `user.updated`, `user.deleted`; its signing secret is set as
      `CLERK_WEBHOOK_SIGNING_SECRET` in Vercel.
- [ ] Session-token customization adds the `metadata` claim (Sessions, Customize session
      token):

      { "metadata": "{{user.public_metadata}}" }

- [ ] Supabase integration activated (adds the `role: "authenticated"` claim to the token).

## Supabase production project

- [ ] Migrations applied (merge to `main` runs `migrate.yml` against production).
- [ ] GitHub `production` environment has the `PRODUCTION_DATABASE_DIRECT_URL` secret that
      `migrate.yml` uses (see `environment.md`).
- [ ] Buckets created in the dashboard with the `storage.md` settings:
  - `uploads`: private, 10 MB limit, JPEG, PNG, WebP.
  - `listing-photos`: public, 5 MB limit, WebP.
- [ ] Realtime set to private channels only (public access off).
- [ ] Authentication, Third-Party Auth: Clerk added with the production instance's domain.
- [ ] `pg_dump` of production taken before any risky migration (Free tier has no automatic
      backups).
- [ ] Staging note: a Free project pauses after 7 days idle, which breaks preview deploys
      until it is unpaused in the dashboard.

## Mapbox

- [ ] Token URL-restricted to `studentsubleases.com` and the preview domains. TBD: the exact
      preview domain pattern is not recorded in docs.

## Web3Forms

- [ ] **After** the hCaptcha contact-form code is deployed to production, open the form at
      app.web3forms.com and enable hCaptcha as its spam protection. Enabling it before the deploy
      makes Web3Forms reject every message from the old form.
- [ ] Send one real message from `https://studentsubleases.com/contact` and confirm it arrives.

## Sentry

- [ ] `NEXT_PUBLIC_SENTRY_DSN` set in Vercel.
- [ ] A test error appears in the `campus-subleases` project (org `ariav-hayempour`) with a
      source-mapped stack trace.

## Smoke test after deploy

- [ ] Sign up a new user and finish onboarding.
- [ ] Post a listing.
- [ ] Approve it as the admin.
- [ ] Message the host from a second account and see the message arrive.
- [ ] Run the cleanup cron:
      `curl -H "Authorization: Bearer $CRON_SECRET" https://studentsubleases.com/api/cron/cleanup`
      returns 200.
