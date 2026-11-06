# Auth (Clerk ↔ database)

- Clerk owns identity, credentials, sessions, and bans. `users` mirrors Clerk users by ID and
  stores no email or password.
- **Webhook** `POST /api/webhooks/clerk` verifies the Svix signature with
  `CLERK_WEBHOOK_SIGNING_SECRET` (400 on failure) and handles `user.created`/`user.updated`
  (upsert first/last name, derived display name, and ban status; never touches the home
  school) and `user.deleted` (delete-if-exists, and best-effort deletion of the user's listing
  photo files). Duplicate deliveries are harmless.
- **Lazy creation:** when the `users` row is missing (webhook delay; local dev, where webhooks
  don't reach localhost), `getActor()` reads the name with `currentUser()` and creates it.
- **Display name:** always `formatDisplayName(first, last)` (`lib/display-name.ts`), e.g.
  "Ada L.", recomputed on every sync. Users change their name in Clerk's profile component.
- **Actor:** `getActor()` returns `{ kind: 'anonymous' }` or
  `{ kind: 'user', userId, isAdmin }`, memoized per request with React `cache`.
- **Admin role:** `publicMetadata.role = "admin"`, set in the Clerk dashboard. Read from the
  session token claim `metadata.role`, which requires the session-token customization
  `{ "metadata": "{{user.public_metadata}}" }` in every Clerk instance. A role change takes
  effect on the user's next token refresh (≤ 60 s).
- **Clerk Backend API wrapper** (`server/clerk/users.ts`, the only module that calls the Backend
  API for users): `getClerkAccount` (null on 404), `setClerkBan`, `deleteClerkAccount` (a 404
  counts as success). Called by `admin-users` (the admin flag on the user page, ban/unban) and
  `account` (delete). `getActor` uses Clerk's `currentUser()` directly.
- **Ban mirroring:** Clerk owns the ban. After `setClerkBan` succeeds, `banUser`/`unbanUser` write
  the returned state to `users.status` through `syncUserFromClerk`, the same mapping the webhook
  uses; the webhook then confirms it. See `admin.md`.
- **Deleted users:** if the `users` row is missing and Clerk reports the user gone, `getActor`
  returns anonymous instead of recreating the row (the token stays valid for up to 60 s). See
  `moderation.md`.
- **Onboarding:** users without a home school are redirected to `/onboarding`
  (`requireOnboardedUser()` in `app/_lib/guards.ts`; `/` also redirects).
- **Return after sign-up:** sign-up buttons (Save, Message host) send Clerk's `redirect_url`. The
  sign-up page turns it into `/onboarding?next=<path>` as its `forceRedirectUrl`, and onboarding
  sends the user to `next` instead of the home school once they pick one (also when an
  already-onboarded user opens such a link). `safeReturnPath` in `lib/return-path.ts` keeps only the
  path, rejects protocol-relative input, and drops auth, onboarding, `/api`, and `/` targets; the
  onboarding action re-checks it because its arguments come from the browser. A returning user
  who switches to sign-in from the sign-up form is returned by Clerk directly.
- **Supabase ↔ Clerk third-party auth:** Supabase Realtime accepts the Clerk session token
  directly (no Supabase Auth users). It is used only so the browser can join its own private
  channel (see `messaging.md`); nothing else in the app reads Supabase as the user. Supabase needs
  the token's `role` claim to be `authenticated`, which Clerk adds once the Supabase integration
  is activated for the instance (`https://clerk.com/setup/supabase`,
  also referenced in `supabase/config.toml`); the channel policy is
  `to authenticated` and reads the `sub` claim (the Clerk user ID). Supabase must also trust the
  instance's Clerk domain (its Frontend API domain, not a secret):
  - **Local:** `[auth.third_party.clerk]` in `supabase/config.toml` (committed; the dev instance
    domain).
  - **Staging:** Supabase dashboard → Authentication → Sign In / Providers → Third-Party Auth →
    add Clerk with the dev instance domain.
  - **Production:** the same, with the production Clerk instance's domain.
- `proxy.ts` runs `clerkMiddleware` on all routes; it protects nothing by itself — pages and
  services enforce access.

## Clerk instance checklist (dev and production)

Email + password sign-up with first and last name required; no usernames; email verification
code required; bot protection on; session-token customization above; webhook endpoint
`/api/webhooks/clerk` subscribed to `user.created`, `user.updated`, `user.deleted`
(production + staging); admin role set on owners; Supabase integration activated (adds the
`role: "authenticated"` claim) and the instance's Clerk domain added under Supabase Third-Party
Auth (config file locally, dashboard for staging and production). The production steps, with
the other launch settings, are in `launch-checklist.md`.
