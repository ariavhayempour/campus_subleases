# Services

Business rules live in `server/services/*`. Each exported function is shaped
`(actor, input) → result`:

1. `requireUser(actor)` / `requireAdmin(actor)` — throws `Forbidden`.
2. `parseInput(schema, input)` with a Zod schema from `lib/validation/` — throws
   `ValidationError` with per-field messages. Forms reuse the same schema client-side.
   Cross-field `.refine`/`.superRefine` checks must set `path` to the field that should
   show the message, or the error is dropped (`fieldErrors` only keeps per-field issues).
3. Permission and business checks — throw typed errors from `server/services/errors.ts`.
4. Data access through `db()` only.

Webhook-driven functions (`syncUserFromClerk`, `deleteUserFromClerk`), `ensureUser`, and
`sweepStaleStorage` take no actor: they are system operations called only from the Clerk webhook,
`getActor`, and the cleanup cron route (which authenticates by `CRON_SECRET`).

## Service files

`users`, `schools`, `listings` (writes), `listing-reads`, `listing-cards`, `listing-sql`,
`photos`, `favorites`, `search`, plus:

- `messaging`: start a conversation, send, mark read (all writes), composer state.
- `messaging-reads`: inbox, thread (with paging), unread count, conversation-start lookup.
- `moderation`: `blockUser`, `unblockUser`, `getBlockState`, `listBlockedUsers`.
- `reports`: `createReport` (visibility, 20/day limit, duplicates, auto-hide).
- `account`: `deleteAccount` (Clerk first, then the local rows).
- `audit`: `writeAudit` (on the caller's executor), `listAuditFor`, `listAuditLog`.
- `admin-listings` (review queue and decisions, counts), `admin-users` (user view, ban/unban),
  `admin-reports` (queue, report view, resolve), `admin-conversations` (logged read-only thread),
  `admin-stats` (trial stats). See `admin.md`.
- `locks`: `lockMessagingUsers`, sorted advisory locks shared by messaging, blocks, and ban.
- `best-effort`: `bestEffort`, post-commit cleanup that reports failures to Sentry.
- `storage-cleanup`: `sweepStaleStorage`, the daily sweep of stale uploads and unreferenced photos
  (no actor; called only from the cron route). See `storage.md`.

`server/clerk/users.ts` is not a service: it wraps the Clerk Backend API and is called only from
services. Tests mock it (see `testing.md`).

**After-commit side effects:** a service that must notify something outside the database does it
after its transaction commits, never inside. `sendMessage` and `startConversation` commit, then
call `publishToUser` (`server/realtime/publish.ts`) for each target with `Promise.allSettled`; a
rejection goes to Sentry and is not rethrown, because the committed write is the source of truth.
Storage cleanup in `listings` follows the same rule (`bestEffort`).

## Errors

`NotFound`, `Forbidden`, `ValidationError` (`fieldErrors`), `ListingCapReached`, `RateLimited`,
`Conflict` — all extend `ServiceError` with a stable `code`.

## Calling services from `app/`

- **Server actions** wrap the call in `runAction()` (`app/_lib/action-result.ts`) and return
  `ActionResult<T>` = `{ ok: true, data } | { ok: false, error: { code, message, fieldErrors? } }`.
  Unexpected errors are rethrown so they reach `error.tsx` and Sentry.
- **Pages** use `orNotFound()` (`app/_lib/guards.ts`) to turn `NotFound` into a 404. Admin pages
  also map `Forbidden` to 404.
- The current actor comes from `getActor()` (`server/auth/get-actor.ts`).
