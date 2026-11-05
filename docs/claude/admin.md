# Admin

Code: `server/services/admin-listings.ts`, `admin-users.ts`, `admin-reports.ts`,
`admin-conversations.ts`, `admin-stats.ts`, `audit.ts`; `app/admin/`; `app/_components/admin-nav-link.tsx`;
`app/_lib/guards.ts`. Shared constants, schemas, and copy: `lib/moderation-options.ts`,
`lib/validation/moderation.ts`, `lib/audit-labels.ts`. User-facing reporting and blocking are in
`moderation.md`. Admin pages are desktop-only (`min-w-[64rem]`).

## Access

- **Role:** `publicMetadata.role = "admin"` in Clerk, read from the session token claim
  `metadata.role` (see `auth.md`). `getActor()` sets `isAdmin` from it, so a role change applies at
  the next token refresh (≤ 60 s).
- **Services:** every admin service starts with `requireAdmin(actor)`, which throws `Forbidden`
  ("Sign in required" for anonymous actors, "Admins only" for signed-in non-admins).
- **Pages:** `app/admin/layout.tsx` calls `requireAdminPage()`, which returns a 404 (`notFound()`)
  for anyone who is not a signed-in admin, so the routes' existence is hidden. Pages that call
  admin services wrap them in `orAdminNotFound()`, which maps both `NotFound` and `Forbidden` to 404. The admin user page also calls
  `requireAdminPage()` itself because it needs the viewer's id.
- **Nav:** the site header shows **Admin** only to admins (`AdminNavLink`), with a badge of pending
  listings plus open reports; its `aria-label` reads "Admin, N to review". The admin sidebar links:
  Overview, Listings, Reports, Stats, Audit log.
- Admin links to listing queues, report pages, user pages, and conversation pages use
  `prefetch={false}` (see Audit log).

## Pages

| Route                       | What it shows                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| `/admin`                    | Overview: pending-listing and open-report counts (linked), the 10 most recent audit rows      |
| `/admin/listings`           | Tabs Pending, Approved, Hidden, Rejected (`?tab=`), school filter (`?school=`); flags per row |
| `/admin/listings/[id]`      | Listing preview, owner, review actions, reports on it, history (audit rows)                   |
| `/admin/reports`            | Report queue; filters status (Open default, Resolved, All), school, reason                    |
| `/admin/reports/[id]`       | Report details, resolution, the reported target, and the Resolve form for open reports        |
| `/admin/users/[id]`         | User status, Ban/Unban, listings, conversations, reports received and filed, history          |
| `/admin/conversations/[id]` | Read-only thread, "Admin view: read-only. This view is logged."                               |
| `/admin/stats`              | Trial stats per active school (`?from=&to=`)                                                  |
| `/admin/audit`              | The latest 200 audit rows                                                                     |

- Listing rows flag "Auto-hidden", "Far from campus: N.N km" (beyond the school's `warn_radius_km`),
  and "N open report(s)". The Pending tab is oldest first ("Submitted"); the others are most recently
  updated first.
- A report page shows a target that no longer exists as "This listing/user/message no longer
  exists."; a deleted reporter, sender, or admin shows as "Deleted user" (or "a removed admin" for
  a resolver) on report, user, and conversation pages.
- Admin pages are `noindex`.

## Review transitions

Any other starting state gives `Conflict`, "This listing's review status changed — reload".

| Action  | From                 | To         | Note                              | Audit action       |
| ------- | -------------------- | ---------- | --------------------------------- | ------------------ |
| Approve | `pending`            | `approved` | clears `review_note`              | `approved_listing` |
| Reject  | `pending`            | `rejected` | required note, 1–1,000 characters | `rejected_listing` |
| Hide    | `approved`, `hidden` | `hidden`   | keeps `review_note`               | `hid_listing`      |
| Unhide  | `hidden`             | `approved` | clears `review_note`              | `unhid_listing`    |
| Delete  | any state            | row gone   | needs `DELETE` typed              | `deleted_listing`  |

- Approve, Reject, Hide, and Unhide set `reviewed_by` and `reviewed_at` (the database `now()`), which
  resets the auto-hide count (see `moderation.md`). Each runs in one transaction under
  `FOR UPDATE` on the listing and writes its audit row in the same transaction.
- Reject's note is shown to the owner; a blank one gives "Give the owner a reason", over 1,000
  characters "Keep the reason under 1,000 characters".
- **Hide on an already-hidden listing** is how an admin _confirms_ an auto-hide (button label "Keep
  hidden"). The Hide button appears for `approved` listings and for auto-hidden ones.
- **Delete** shares `deleteListingRow` (`listings.ts`) with the owner's delete: it removes the row
  (photos and favorites cascade; conversations keep their threads with the listing set null) and
  returns the photo paths, deleted from storage after commit with `bestEffort`. The audit snapshot
  keeps `title`, `ownerId`, and `schoolSlug`. After deleting, the admin is redirected to
  `/admin/listings`.
- Every decision action revalidates the `/admin` layout, the public listing page, and
  `/me/listings`.

## Stale checks

- Approve and Reject carry a `version` token: `listingVersion`, `updated_at` rendered as text at
  microsecond precision (`listing-sql.ts`). A JS `Date` would round to milliseconds and cause false
  conflicts. Any owner write, status changes included, bumps `updated_at`, so it counts as an edit.
- If the token no longer matches: `Conflict`, "This listing was edited — reload to review the new
  version". The state check runs first, so a second admin racing the first sees "review status
  changed" rather than "edited". The error shows a **Reload** link (a plain anchor, to force a fresh
  token).
- `getAdminListing` reads the version before the content, so an edit in between yields a token
  older than what is shown and the approve conflicts instead of approving unseen changes.
- Hide, Unhide, and Delete take no version: they do not approve content.

## Ban and unban

- `/admin/users/[id]` → **Ban user** / **Unban user** (browser `confirm()`: "Ban {name}? They will be
  signed out and their listings hidden." / "Unban {name}?"). Hidden for yourself and for admins.
- `banUser` / `unbanUser` (`admin-users.ts`): refuse yourself (`Forbidden`, "You can't ban yourself" /
  "You can't unban yourself"); read the Clerk account (`getClerkAccount`; missing gives `NotFound`,
  "User not found"); refuse admins ("Admins can't be banned" / "Admins can't be unbanned").
- **Clerk first, then the local mirror:** `setClerkBan` (`server/clerk/users.ts`) bans or unbans in
  Clerk; the service then writes the returned state into `users.status` with `syncUserFromClerk`,
  the same mapping the webhook uses, and the audit row (`banned_user` / `unbanned_user`,
  snapshot `displayName`), in one transaction under the user's messaging lock. The webhook's
  `user.updated` then confirms it idempotently. The immediate mirror exists because webhooks never
  reach local development, which could otherwise not ban anyone.
- **Already in the requested state:** the Clerk call is skipped when Clerk already matches. The audit
  row is written whenever the local `users.status` actually changes (read under the lock), so a
  double submit leaves one row and a retry after a failed local transaction still logs the ban.
- If Clerk fails, nothing changes locally. The user page reads the target's admin flag from Clerk to
  hide the buttons; if Clerk is unreachable the flag is unknown and the buttons show, but the service
  re-checks on every ban.
- A banned user has no public listings (the owner must be active), cannot send messages, and
  appears to the other side as "You can't reply to this conversation" (see `messaging.md`).

## Reports queue

- `/admin/reports` lists up to 100 reports, newest first. Each row's school is the target's school:
  a listing's school, a message's listing school (falling back to the sender's home school when the
  listing is gone), or a user's home school.
- **Resolve** needs a note ("Add a resolution note"; up to 1,000, "Keep the note under 1,000
  characters") and takes no action on the target. A second resolve gives `Conflict`, "This report
  is already resolved". It writes `resolved_report` with the note in the snapshot and revalidates the
  `/admin` layout; the form does not call `router.refresh()`, so one resolve logs one conversation
  view.
- A message report shows the thread inside the report (this counts as a view, see Audit log). If
  the reported message is older than the 1,000-message window, it is shown separately above the
  thread.
- Other open reports on the same target are noted ("N other open reports on this target").

## Audit log

- Table `admin_audit_log`: `admin_id` (null for the system and for deleted admins), `action`,
  `target_type` (listing, user, report, conversation), `target_id` (text), `snapshot` (jsonb).
- Actions and labels (`lib/audit-labels.ts`): `approved_listing` Approved listing,
  `rejected_listing` Rejected listing (snapshot: note), `hid_listing` Hid listing,
  `auto_hid_listing` Auto-hid listing (no admin; written by `createReport`), `unhid_listing` Unhid
  listing, `deleted_listing` Deleted listing, `resolved_report` Resolved report (snapshot: note),
  `banned_user` Banned user, `unbanned_user` Unbanned user, `viewed_conversation` Viewed
  conversation.
- **Every render of an admin conversation writes a `viewed_conversation` row**, inside the same
  transaction as the read (`loadAdminConversation`). A report page that shows a message inside its
  conversation counts. So admin links to reports, users, conversations, and the admin nav use
  `prefetch={false}`; otherwise hovering a link would log a view.
- `writeAudit(executor, entry)` runs on the caller's executor, so the audit row commits or rolls
  back with the action. `listAuditFor` gives one target's history (oldest first); `listAuditLog`
  gives the latest 200 for `/admin/audit`.
- `/admin/audit` is a plain list of the latest 200 audit rows, newest first, with no filters or paging.

## Stats

`/admin/stats`, per active school, with dates compared in the school's timezone. Default range is
the last 30 days ending today (UTC date); a range must be valid, start on or before end, and at most
366 days.

- **Listings posted:** created in range.
- **Approved listings with a message:** of the listings created in range that have an
  `approved_listing` audit row, how many have a conversation. Shown as "X of Y (P%)".
- **Median time to host's first reply:** over conversations created in range, from the first message
  to the host's first later message. Conversations without a reply are excluded, as are those whose
  listing (and so school) or host was deleted; the count of replied conversations is shown.
- **Listings marked taken:** `taken_at` in range.

Listings approved before the audit log existed (approved by SQL) have no audit row and do not count
as approved.

## Decisions that can look like bugs

- **Review transitions are fixed:** Approve and Reject only from `pending`; Hide from `approved` or
  `hidden`; Unhide from `hidden`; Delete from any state. Approve and Unhide clear the review note.
  Hiding an already-hidden listing is how an admin confirms an auto-hide (see Review transitions).
- **Stale checks use text, and any owner write counts.** A status change by the owner bumps
  `updated_at`, so it also makes an open review stale (see Stale checks).
- **The "Auto-hidden" flag** shows while an `auto_hid_listing` audit row is newer than `reviewed_at`
  (see `moderation.md`).
- **What a reporter may report:** a user other than themselves; a public listing, or one they have a
  conversation on, that is not their own; a message from the other person in their conversation.
  Anything else is `NotFound` or a self-report `ValidationError` (see `moderation.md`).
- **Report UI is for signed-in users only:** "Report listing" on the listing page (not for the
  owner or admins), "Report user" in the thread menu, "Report message" on the other person's
  messages.
- **Each render of an admin conversation writes one `viewed_conversation` row,** including a report
  page that shows the message in its thread, so admin links use `prefetch={false}` (see Audit log).
- **`/admin/audit` is only the latest 200 rows** (see Audit log).
- **`/settings` has profile (opens Clerk's profile), blocked users, and account deletion, and no
  home-school setting** (owner decision: the home school is set once at onboarding).
- **Account deletion needs `DELETE` typed to confirm.**
- **Trial stats** have the definitions in the Stats section; listings approved by SQL before the
  dashboard existed have no audit row and do not count as approved.
- **Admin lists are capped:** 100 rows per listing tab, report queue, and user-page section; 200
  audit rows; 1,000 messages per admin conversation view ("Showing the latest 1,000 messages").
  There is no pagination in v1.
- **The Pending tab and nav badge count only `pending` listings that are `active` and not expired.**
  Others cannot go live, so they are not work for the queue.
- **Ban mirrors Clerk immediately** instead of waiting for the webhook (see Ban and unban). An admin
  cannot ban themselves or another admin.
- **Account deletion runs Clerk first, then the database immediately,** and the `user.deleted`
  webhook also deletes photo files (see `moderation.md`).
- **`/messages/[id]` stays participant-only,** admins included (404). Admins read a thread at
  `/admin/conversations/[id]`, which is logged.
- **Report resolution takes no action on its target;** actions are separate buttons.
- **Auto-hide applies only to `approved` listings,** counts distinct non-null reporters, and is
  confirmed by Hide on the hidden listing (see `moderation.md`).
- **Resolved reports still count toward the 3 distinct reporters;** only a review resets the count.
- **The stale token is text, not a `Date`** (see Stale checks).
- **Review state is checked before the version,** so a racing second admin gets the status message.
- **`reviewed_at` uses the database clock** (`now()`), matching the report and audit timestamps the
  auto-hide count compares against.
- **Admin E2E covers four paths:** approve, reject and resubmit, a renter's report resolved by
  the admin, and ban then unban of a throwaway Clerk user. Conversation pages are covered by
  service tests and review, not browser tests. Listings are seeded by SQL; approval goes through
  the admin UI (see `testing.md`).
- **Trial stats are computed on request** from stored data; there is no cache.

## Known issues

- **Audit rows for a deleted listing still link to its page, which is now a 404.** Rows that target
  the listing (approve, reject, hide, unhide, auto-hide) keep linking to `/admin/listings/[id]`; only
  the `deleted_listing` row itself is unlinked. `resolved_report` rows target the report, which still
  exists. The `deleted_listing` snapshot (title, owner, school) is the record. Deferred.
- **Audit rows for a deleted user link to a 404 too:** `banned_user` and `unbanned_user` rows link
  to `/admin/users/[id]`, which is gone once the account is deleted. Deferred.
