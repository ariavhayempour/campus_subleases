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

Webhook-driven functions (`syncUserFromClerk`, `deleteUserFromClerk`) and `ensureUser` take no
actor: they are system operations called only from the Clerk webhook and `getActor`.

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
