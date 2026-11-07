# Rate limits and quota protection

The site runs on free tiers (Vercel Hobby, Supabase Free, Mapbox, Web3Forms). The goal is that no
single abuser can use up a monthly quota and break a feature for everyone. Limits live in three
places: in-app services, the Vercel Firewall, and the providers' own dashboards.

## In-app limits

All counted per signed-in user unless noted. Over the limit, the service throws `RateLimited` and
the action shows its message.

| What                                      | Limit                                                 | Counted by            | Docs            |
| ----------------------------------------- | ----------------------------------------------------- | --------------------- | --------------- |
| Signed photo upload URLs                  | 20 / hour (one per file)                              | `rate_limit_counters` | `listings.md`   |
| Save / unsave a favorite                  | 20 / minute                                           | `rate_limit_counters` |                 |
| Browse "Load more"                        | 20 / minute signed in; 120 / minute per IP signed out | `rate_limit_counters` | `search.md`     |
| Load earlier messages                     | 15 / minute                                           | `rate_limit_counters` | `messaging.md`  |
| Block and unblock (shared)                | 10 / hour                                             | `rate_limit_counters` | `moderation.md` |
| Listing status change and delete (shared) | 5 / hour                                              | `rate_limit_counters` | `listings.md`   |
| Onboarding submit                         | 10 / hour                                             | `rate_limit_counters` |                 |
| Messages sent                             | 30 / minute                                           | `messages` rows       | `messaging.md`  |
| New conversations                         | 15 / 24 hours                                         | `conversations` rows  | `messaging.md`  |
| New listings (non-admin)                  | 5 / 24 hours                                          | `listings` rows       | `listings.md`   |
| Reports                                   | 20 / 24 hours                                         | `reports` rows        | `moderation.md` |

Copy: minute limits say "You're doing that too fast — wait a minute and try again."; hour limits
say "Too many changes — try again in an hour."; photo uploads say "Too many photo uploads — try
again in an hour".

The first browse page is rendered on the server and is never limited in-app; only "Load more" is.
Restoring the loaded cards after Back fetches every remembered page (up to ten, `MAX_LOAD_CARDS`)
in one request, so it costs one unit.

Signed-out callers are keyed by IP (`x-real-ip`, else the first `x-forwarded-for` entry, both set
by Vercel; see `lib/client-ip.ts`). Many students can share one campus NAT address, so signed-out
"Load more" has its own higher allowance (`RATE_LIMITS.loadMoreSignedOut`). IPv6 callers are keyed
by their /64 network (one client usually controls a whole /64), and IPv4-mapped IPv6 addresses by
their IPv4 address. Locally Next fills `x-forwarded-for` from the socket, so signed-out callers are
keyed `ip:0:0:0:0::/64` (`::1`) or `ip:127.0.0.1`.

## The limiter

`server/services/rate-limit.ts`:

- `consume(rule, subject, { cost?, now? })` upserts `(key, window_start)` in `rate_limit_counters`.
  The conflicting update only applies when `count + cost <= limit` (`ON CONFLICT … DO UPDATE …
WHERE`); otherwise no row comes back and it throws `RateLimited(rule.message)`. One atomic
  statement, so concurrent calls cannot overshoot. A single call costing more than the limit is
  refused without touching the table.
- **Rejected calls change nothing.** A batch that would go over (for example 6 photos with 5 left)
  is refused, and a smaller one still fits. In a fixed window, counting rejections would not keep a
  hammered limit shut any longer anyway.
- **Fixed windows** aligned to the database clock (`clock_timestamp()`, floored to the window), so
  app servers with skewed clocks agree. `now` exists only for tests. A burst across a boundary can
  reach up to twice the limit; accepted.
- Every rule is a named constant in `RATE_LIMITS`. Services first settle refusals that cost
  nothing to check (invalid input, self-block, an unchanged listing status, a listing the caller
  doesn't own), then call `consume`, then do the real work. A rejected call creates no signed URLs,
  rows, or Storage objects.
- Admins are not exempt.
- **Fails open if the table is missing** (Postgres `42P01`): the call goes through and the error
  goes to Sentry. Vercel can deploy before `migrate.yml` creates the table; without this, every
  limited action (including onboarding) would fail in that window. Any other database error still
  propagates.
- Client components show a `RateLimited` message as written (`actionErrorMessage` in
  `app/_lib/action-message.ts`), and keep their generic "try again" text for other failures.
- The daily cleanup cron deletes rows older than 24 hours by the database clock
  (`purgeExpiredRateLimits`). It runs alongside the storage sweep, so a failing sweep never skips
  it (and the sweep's error still reaches Sentry).
- E2E global setup truncates the table so local reruns don't trip the hour limits.

The older limits (messages, conversations, listings, reports) count existing rows instead, under
advisory locks; see their docs.

## Outside the app

Browser-side keys can't be protected by server code, because anyone can copy them from the page.

- **Vercel Firewall:** custom rule `Per-IP rate limit` (`rule_per_ip_rate_limit_BnVbQX`): fixed
  window, 300 requests per 60 s per IP, on every path except `/_next/`. Hobby allows one rate-limit
  rule per project and includes 1,000,000 allowed requests. It was published on 2026-11-06 in
  **Log** mode (counts, never blocks). After reviewing the logs, switch it to the default 429
  action (see `launch-checklist.md`). Manage it with `vercel firewall rules …` or the dashboard
  (Firewall → Configure); changes are staged until published.
- **Web3Forms (contact form):** hCaptcha, enforced by Web3Forms once enabled in its dashboard, plus
  a 60-second browser cooldown. See `site-pages.md`.
- **Mapbox:** the public token is used straight from the browser, so the protection is a
  URL-restricted token (needs a card on the account; then overage is billed) and loading less:
  the browse map loads on demand on phones, and the listing-page map loads only when it scrolls
  near the viewport. If the token is abused, rotate it (see `launch-checklist.md`).
- **Clerk:** bot protection on sign-up.
- **Sentry:** spike protection is on by default. **Realtime:** only the server broadcasts, behind
  the message limits.
