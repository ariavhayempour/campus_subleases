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

## Messaging and Realtime tests

- **Service tests mock the publisher.** `tests/services/messaging-send.test.ts` replaces
  `@/server/realtime/publish` with `vi.fn()` so sends never touch Realtime; it asserts the calls
  (recipient and sender, same event) and, with `mockRejectedValue`, that a failed publish does not
  fail the send. Fixtures: `tests/helpers/messaging.ts` (`liveListing`, `insertConversation`,
  `insertMessage`).
- **Realtime integration tests** (`tests/realtime/publish.test.ts`) use the real local Realtime
  service, so `supabase start` must include it (CI no longer excludes it). `tests/helpers/realtime.ts`
  reads the URL, publishable key, and JWT secret from `supabase status`, refuses non-local hosts,
  and signs a short-lived HS256 token locally (claims `sub`, `role: authenticated`) with
  `node:crypto`, standing in for a Clerk token. They cover delivery to the owner of a channel,
  refusal to join another user's channel, no delivery to public (anonymous or other-user) subscriptions of a user channel, publishing with no subscriber, and the unreachable-host
  error. A client must call `realtime.setAuth()` before joining a private channel. `joinChannel`
  waits through transient `CHANNEL_ERROR`s until `SUBSCRIBED` (rejects on `CLOSED`, `TIMED_OUT`, or a
  10 s deadline); tests expecting refusal pass `{ expect: 'refused' }`.
- **Policy test:** `tests/db/realtime-policy.test.ts` (see `database.md`).

## Storage

- Storage tests use the local Supabase stack (`pnpm db:start`); `tests/local-supabase.ts` reads
  the URL and secret key from `supabase status` (or the CI env) and refuses non-local hosts.
- Storage writes are not rolled back with `withRollback`. Tests clean up with `cleanupStorage()`
  (`tests/helpers/photos.ts`). Known gap: some service tests that process photos inside
  `withRollback` still leak processed `listing-photos` objects, so local storage accumulates
  files over time.
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
  `signInTestUser()` (`e2e/helpers/sign-in.ts`) signs in the test user from
  `E2E_CLERK_USER_EMAIL` (a real user in the Clerk dev instance whose address contains
  `+clerk_test`). It signs in from `/`, where no `<SignIn />` is mounted to race Clerk's own
  redirect.
- Sign-in uses the `email_code` strategy (fixed code `424242` for `+clerk_test` addresses).
  Password sign-in returns `needs_client_trust` because Client Trust treats every fresh
  Playwright browser as a new device, and `@clerk/testing` does not handle that status.
- Without `E2E_CLERK_USER_EMAIL` the Clerk-dependent tests are skipped locally but fail in CI, so
  a missing secret cannot produce a green run.
- Tests that need a fresh user state read the Clerk user ID from `window.Clerk` after sign-in
  and delete the `users` mirror row; lazy creation rebuilds it.
- Listing tests seed rows directly via SQL (`e2e/helpers/listings.ts`), so E2E needs no Mapbox
  token; the create form itself is verified manually.
- Browse/favorites specs seed approved listings owned by a database-only host
  (`user_e2e_browse_host`, `e2e/helpers/browse.ts`) so the Clerk test user can save them;
  deleting the host cascades its listings and favorites. Seeded text includes "Zebracorn" and
  tests scope to `?q=zebracorn`, so other local data never affects assertions.
- `seedBrowseListings` takes an optional `description`; a listing seeded without "Zebracorn" in
  its title or description proves a keyword filter is carried (e.g. by "Load more").
- `signInThroughForm()` fills Clerk's `<SignIn />` form on the current page (email, "Use another
  method", email code `424242`), for tests that must prove Clerk's return redirect. It depends on
  Clerk's button labels; `setupClerkTestingToken({ page })` must run first.
- CI has no Mapbox token, so E2E never asserts on the map.
- Playwright keeps traces on failure (`trace: 'retain-on-failure'`); CI retries once.
- **Two-user messaging E2E** (`e2e/messaging.spec.ts`): host and renter sign in with
  `E2E_CLERK_USER_EMAIL` and `E2E_CLERK_USER2_EMAIL` in separate browser contexts, each with its
  own `setupClerkTestingToken`. The listing is seeded and approved by SQL
  (`e2e/helpers/listings.ts`). Without either email the test is skipped locally and fails in CI.
  The test sets a 90 s timeout (two sign-ins plus a multi-page flow). Live assertions (the host's
  unread badge and the renter's incoming reply) use 15 s timeouts, since they depend on Realtime
  delivery. The host waits on `/me/listings` so the badge must arrive without navigation.
- **Cleanup:** `resetMessaging(userIds)` (`e2e/helpers/messaging.ts`) deletes conversations
  (messages cascade) involving the users and the blocks between them. An `afterEach` runs the
  independent steps (close contexts, `resetMessaging`, `removeListings`, `removeBrowseHost`) under
  `Promise.allSettled` and reports every failure, so a failed step cannot skip the rest.
- Default project is desktop Chrome (the site is desktop-first).
