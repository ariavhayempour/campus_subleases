# Testing

## Service tests (Vitest)

- Need local Supabase: `pnpm db:start`. Vitest global setup applies migrations first.
- Wrap each test in `withRollback(async () => { ... })` (`tests/helpers/db.ts`): everything the
  test and the services it calls write is rolled back. Seeded schools are always present.
- Expecting a constraint violation? Use `catchDbError(fn)`; it runs `fn` in a savepoint so the
  test transaction stays usable, and returns the error message chain.
- Fixtures: `createUser`, `createSchool`, `listingValues` in `tests/helpers/fixtures.ts`.
- Webhooks: `signedClerkWebhook(payload)` signs a request with the test secret configured in
  `vitest.config.ts`; call the route's `POST` directly.

## Storage

- Buckets (`uploads`, `listing-photos`) are declared in `supabase/config.toml` and seeded by
  `pnpm db:start` (`supabase seed buckets --local`); `supabase start` alone does not create them.
- Troubleshooting: storage uploads fail with a 500 and Postgres 42P10 ("no unique or exclusion
  constraint matching the ON CONFLICT specification"). The storage schema on a long-lived local
  volume has likely drifted from the storage-api image. Local-only workaround (run as
  `supabase_admin`):
  `create unique index idx_objects_current_version_c on storage.objects (bucket_id, name collate "C") where archived_at is null`.
  Clean alternative that wipes local data: `supabase stop --no-backup && pnpm db:start`.

## E2E (Playwright)

- `pnpm test:e2e` starts `pnpm dev` locally (`pnpm start` in CI, after `pnpm build`).
- Clerk: `clerkSetup()` in global setup issues a testing token (bypasses bot protection);
  `clerk.signIn()` signs in the test user from `E2E_CLERK_USER_EMAIL` (a real user in the
  Clerk dev instance whose address contains `+clerk_test`).
- Sign-in uses the `email_code` strategy (fixed code `424242` for `+clerk_test` addresses).
  Password sign-in returns `needs_client_trust` because Client Trust treats every fresh
  Playwright browser as a new device, and `@clerk/testing` does not handle that status.
- Without `E2E_CLERK_USER_EMAIL` the onboarding test is skipped locally but fails in CI, so a
  missing secret cannot produce a green run.
- Tests that need a fresh user state read the Clerk user ID from `window.Clerk` after sign-in
  and delete the `users` mirror row; lazy creation rebuilds it.
- Default project is desktop Chrome (the site is desktop-first).
