# Moderation

Code: `server/services/reports.ts` (create, auto-hide), `moderation.ts` (blocks), `account.ts`
(deletion), `server/clerk/users.ts` (Clerk Backend API wrapper), `audit.ts`, `locks.ts`,
`best-effort.ts`. UI: `app/_components/report-button.tsx` and `report-dialog.tsx`,
`app/_lib/report-action.ts`, `app/settings/`. Constants (limits, labels, copy) live in
`lib/moderation-options.ts`; schemas in `lib/validation/moderation.ts`. The admin side is in
`admin.md`.

## Reports

- **Who can report what** (`createReport`, signed-in users only):
  - A **user** that exists and is not the reporter.
  - A **listing** that is public (`isPublicListing`) with no block between reporter and owner
    (`noBlockWith`), or one the reporter has a conversation on as renter. Not the reporter's own.
  - A **message** in a conversation the reporter is part of, sent by the other person.
  - Anything the reporter may not see gives `NotFound`, so ids cannot be probed. The self cases
    give a `ValidationError` on `targetId`: "You can't report yourself", "You can't report your
    own listing", "You can't report your own message".
- **Reasons** (`REPORT_REASONS`): Scam or fraud, Spam, Inappropriate content, Harassment,
  Something else. Optional details, up to 1,000 characters ("Keep details under 1,000
  characters"). A missing reason gives "Choose a reason".
- **Rate limit:** 20 reports per reporter per rolling 24 hours (`MAX_REPORTS_PER_DAY`), counted in
  the database. The check and the insert run in one transaction after a per-reporter advisory lock
  (`pg_advisory_xact_lock(hashtext('reports:' || userId))`), so concurrent reports cannot both
  pass. Over the limit: `RateLimited`, "You can send up to 20 reports a day. Try again tomorrow."
- **Block and unblock** share one limit of 10 per user per hour, including unblocks from
  Settings (fixed window; see `rate-limits.md`).
- **Duplicates:** a partial unique index (`reports_open_unique`: reporter, target type, target id,
  where `status = 'open'`) allows one open report per reporter per target. The insert uses
  `ON CONFLICT DO NOTHING`; a conflict gives `Conflict`, "You've already reported this. We'll
  review it soon." Once an admin resolves the report, the same person may report the target again.
- **Confirmation copy:** "Thanks. We'll review your report." (`REPORT_SENT`).
- **Where the buttons are** (all signed-in only; they open `ReportDialog`):
  - **Report listing** on the listing page, for visitors only: not the owner, not admins.
  - **Report user** in the thread's "Conversation options" menu (`⋯`).
  - **Report message** next to each message from the other person in a thread (messages whose
    sender is gone get no button).
- `reportAction` revalidates the `/admin` layout so the nav badge and queue counts update.

## Auto-hide

- A listing that is `approved` and has reports from **3 distinct reporters** (`AUTO_HIDE_REPORTERS`)
  since its last review (`reviewed_at`, or `created_at` if never reviewed) becomes `hidden`. The
  same transaction writes an `auto_hid_listing` audit row with no admin.
- The count is made under a row lock on the listing, so concurrent reports cross the threshold
  exactly once. The locked read also returns the count start,
  `coalesce(reviewed_at, created_at)`, as text (a JS `Date` would drop its microseconds), and the
  count query takes it as a `timestamptz` parameter instead of joining `listings` again.
- Only reports with a non-null reporter count; a deleted reporter's report stops counting. Reports
  on listings that are not `approved` only queue.
- **Counter reset:** every Approve, Reject, Hide, and Unhide sets `reviewed_at`, so reports filed
  before that no longer count. A confirmed or reversed auto-hide therefore starts from zero.
- **"Auto-hidden" flag:** a `hidden` listing is flagged "Auto-hidden" (on the admin Hidden tab and
  listing page) while an `auto_hid_listing` audit row for it is newer than `reviewed_at`. The
  review button reads "Keep hidden" while the flag is set. Clicking it hides the already-hidden
  listing, which writes `hid_listing`, sets `reviewed_at`, and clears the flag: that is how an
  admin confirms an auto-hide. Unhide restores `approved`.

## Blocks

- **Block user / Unblock** are in the thread menu (see `messaging.md`). `/settings` lists every
  user you have blocked, newest first, with the date (in the viewer's zone, via
  `<LocalTime dateOnly />`) and an **Unblock** button; the empty state
  is "You haven't blocked anyone." Unblocking from `/settings` revalidates `/settings` and the
  `/messages` layout.
- `blockUser` takes both users' messaging advisory locks (sorted, via `lockMessagingUsers` in
  `locks.ts`) before inserting. `sendMessage` and `startConversation` take the sender's lock and
  re-check blocks inside their transaction, so a send either commits before the block or waits and
  sees it. A foreign-key failure on the insert (the other user was just deleted) gives
  `NotFound`, "User not found".
- Reports respect blocks only for public listings: a visitor who is blocked in either direction
  cannot report that listing, since the listing page is a 404 to them. A blocked renter who has a
  conversation on the listing still can, and anyone can report the user from a thread.

## Account deletion

- **`/settings` → Delete account:** the user types `DELETE` (`CONFIRM_WORD`); anything else gives
  "Type DELETE to confirm". The copy says it permanently deletes listings, photos, and favorites,
  and that messages stay visible to the other person as "Deleted user".
- **Order** (`deleteAccount`): validate, then delete the Clerk account (`deleteClerkAccount`; a
  Clerk 404 counts as success), then `deleteUserFromClerk` removes the `users` row and, after the
  transaction commits, the listings' photo files (`bestEffort`, failures go to Sentry). Clerk
  goes first so a Clerk failure leaves the local account intact and retryable.
- **After success** the browser signs out and goes to `/`. `deleteAccountAction` deliberately does
  not revalidate: re-rendering as the just-deleted user would hit a missing Clerk account.
- **Deleted:** the user, their listings (and photo rows, favorites on them), their favorites, and
  blocks in both directions.
- **Stays, with the user set to null:** messages (shown as "Deleted user"), conversations (the
  other side keeps the thread; sending is refused), reports they filed (they stop counting toward
  auto-hide), and audit rows naming them as admin. Reports about them or their listings stay in
  the queue and show the target as deleted.
- **Webhook path:** Clerk's `user.deleted` event calls the same `deleteUserFromClerk`, which
  deletes if the row exists, so it is harmless after `deleteAccount` and also cleans up accounts
  deleted from the Clerk dashboard, photo files included.
- **Token window:** a deleted user's session token stays valid for up to 60 s. `getActor` finds the
  `users` row missing, asks Clerk, and returns anonymous if the account is gone (`currentUser()`
  null or a 404) instead of recreating the row.

## Side-effect helpers

- `bestEffort(cleanup)` (`best-effort.ts`) runs storage cleanup after commit and sends failures to
  Sentry instead of failing the request. Used by listing saves and deletes, admin delete, and
  user deletion.
- `lockMessagingUsers(executor, ids)` (`locks.ts`) takes `pg_advisory_xact_lock` for each distinct
  id in sorted order, so two callers locking the same pair cannot deadlock. Used by messaging,
  `blockUser`, and ban/unban.

## Decisions that can look like bugs

- **Report UI is signed-in only.** Anonymous visitors see no report buttons. The owner and admins
  do not see "Report listing".
- **A resolved report can be re-filed;** only open duplicates are blocked.
- **Resolving a report takes no action on its target.** Hide, delete, and ban are separate admin
  buttons.
- **A reporter's deletion lowers the auto-hide count** because only non-null reporters count.
- **Resolved reports still count toward the 3 distinct reporters.** Resolving two reports with no
  action does not reset the count; only a review of the listing does.
- **Auto-hide never touches a listing that is not `approved`.** It cannot un-reject or re-hide.
- **There is no home-school setting.** The home school is chosen once at onboarding; `/settings`
  has only profile, blocked users, and account deletion.
- **Name, email, and password** are edited in Clerk's profile (`Edit profile` opens
  `useClerk().openUserProfile()`); the header has a "Settings" link.
- **Account deletion needs Clerk to be reachable.** If Clerk fails with anything but a 404 the
  action errors and nothing local changes.
