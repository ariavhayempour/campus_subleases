# Auth (Clerk ↔ database)

- Clerk owns identity, credentials, sessions, and bans. `users` mirrors Clerk users by ID and
  stores no email or password.
- **Webhook** `POST /api/webhooks/clerk` verifies the Svix signature with
  `CLERK_WEBHOOK_SIGNING_SECRET` (400 on failure) and handles `user.created`/`user.updated`
  (upsert first/last name, derived display name, and ban status; never touches the home
  school) and `user.deleted`
  (delete-if-exists). Duplicate deliveries are harmless.
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
- **Onboarding:** users without a home school are redirected to `/onboarding`
  (`requireOnboardedUser()` in `app/_lib/guards.ts`; `/` also redirects).
- `proxy.ts` runs `clerkMiddleware` on all routes; it protects nothing by itself — pages and
  services enforce access.

## Clerk instance checklist (dev and production)
Email + password sign-up with first and last name required; no usernames; email verification
code required; bot protection on; session-token customization above; webhook endpoint
`/api/webhooks/clerk` subscribed to `user.created`, `user.updated`, `user.deleted`
(production + staging); admin role set on owners.
