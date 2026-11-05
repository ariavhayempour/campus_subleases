# Messaging

Code: `server/services/messaging.ts` (writes), `messaging-reads.ts` (inbox, thread, unread count),
`moderation.ts` (block/unblock, blocked-users list), `reports.ts` (reporting),
`server/realtime/publish.ts`, `app/_lib/realtime-client.ts`,
`app/_components/messaging-provider.tsx`, `app/messages/`. Shared constants and types live in
`lib/messaging-options.ts`; schemas in `lib/validation/messaging.ts`.

## Flow

1. A signed-in student opens a public listing they do not own. The listing page shows **Message
   host** (`MessageHostButton`) to every viewer except the owner and admins. Signed out, it is
   Clerk's `SignInButton` in redirect mode, which returns to the listing after sign-in.
2. Signed in, it links to `/messages/new?listing=<id>`. If the viewer already has a conversation
   on that listing the button reads **View conversation** and links straight to it.
3. `/messages/new` calls `getConversationStart`. A missing, non-public, own, or blocked listing is
   a 404. An existing conversation redirects to `/messages/<id>`; otherwise the page shows the
   listing header, the safety note, and an empty composer. No row exists yet.
4. The first message calls `startConversation`, which creates the `conversations` row and the
   first `messages` row in one transaction, then the browser replaces the URL with
   `/messages/<id>`.
5. A conversation is unique per `(listing, renter)`. Starting twice (a stale tab, a double submit)
   appends to the existing conversation instead of creating a second one.
6. Existing conversations keep working after the listing changes: `sendMessage` never checks the
   listing. A taken, expired, rejected, hidden, or deleted listing does not stop replies. If the
   listing is deleted, the header reads "Listing removed". Only a new conversation needs a
   public listing.

`/messages` is two panes at 768px and up (inbox left, thread right) and one pane below, with a
"Back to messages" link in a thread. It is `noindex`, requires sign-in and onboarding, and shows
the 100 most recent conversations. Empty states: "No messages yet. Message a host from any
listing to start a conversation." (inbox) and "Select a conversation" (no thread open, wide
screens).

## Rules

- **Who can start:** a signed-in, non-banned user who is not the listing's owner, on a listing
  that is public (`isPublicListing`) with no block in either direction. Owners get "You can't
  message yourself"; a banned sender gets "You can't reply to this conversation".
- **Who can send:** only the two participants (anyone else gets 404, below), and only while the
  composer state is `open`.
- **Body:** trimmed, 1 to 2,000 characters. Messages: "Write a message" and "Messages can be up
  to 2,000 characters". The textarea also has `maxLength` 2000. Enter sends, Shift+Enter adds a
  line (not while composing with an IME).
- **Composer states** (`composerStateFor`, checked in this order). The same states gate sending:
  `sendMessage` and `startConversation` (when a conversation exists) throw `Forbidden` with the
  matching text.

  - `open`: none of the below. The thread shows the composer.
  - `deleted_user`: the other participant's account was deleted. Shows "This account was
    deleted".
  - `you_blocked`: the viewer blocked the other user. Shows "You blocked this user" and Unblock.
  - `cannot_reply`: the other user blocked the viewer, or either is banned. Shows "You can't reply
    to this conversation".

A deleted account is checked first, then `you_blocked`, then `cannot_reply`. The blocked user is
never told they were blocked: they see the generic `cannot_reply` text.

- **Rate limits** (counted from the database, rolling windows):
  - 30 messages per sender per minute across all conversations: "You're sending messages too
    fast — wait a minute".
  - 15 new conversations per renter per 24 hours: "You can start up to 15 new conversations a
    day — try again tomorrow". Only creating a conversation counts; replying never does.
- **Limit-check order and locking:** each send or start runs in one transaction that first takes a
  per-sender advisory lock (`pg_advisory_xact_lock(hashtext('messaging:' || userId))`), so
  concurrent sends cannot both pass the check. `markConversationRead` takes no lock. Permission
  checks (listing, blocks, bans) also run before the transaction, so common refusals fail fast,
  and are re-checked under the lock:
  - `sendMessage`: lock, full composer-state re-check, message limit, insert.
  - `startConversation`: lock, look the conversation up again, re-check, message limit,
    conversation limit (only when creating one). For an existing conversation the re-check is the
    full composer state. For a new one a block gives "Listing not found", and a ban of either
    user gives "You can't reply to this conversation", both checked under the lock.
  - `blockUser` takes both users' locks (sorted, via `lockMessagingUsers`) before inserting, so a
    send either commits before the block or waits and sees it.

  Both windows compare against `clock_timestamp()`.

- **`clock_timestamp()`, not `now()`:** messaging writes `created_at`, `last_message_at`, and read
  times with `clock_timestamp()`. `now()` is frozen for a whole transaction, which would give
  several messages in one transaction (and every rolled-back service test) identical times, and
  the unread rule and paging order depend on distinct, ordered times. `last_message_at` and the
  sender's read time use `greatest(...)` so concurrent sends from both sides cannot move them
  backwards.
- **Sending marks the conversation read for the sender**, to the new message's time.
- **No edit or delete.** Users cannot edit or delete messages in v1.

## Unread

- A conversation is unread for a user when its `last_message_at` is later than that user's
  `host_last_read_at`/`renter_last_read_at` (null counts as never read) **and** the latest
  message was not sent by that user. The badge counts unread **conversations**, not messages.
- Read times are written by `markConversationRead` (server action `markReadAction`) when a
  thread mounts, when a message from the other person arrives while the tab is visible, and on a
  resync while visible; and by sending (above). A message that arrives in a hidden tab waits, and
  the next focus resync marks it read.
- The nav link shows the count in a badge and its accessible name becomes "Messages, N unread".
  The tab title gets a `(N) ` prefix (`withUnreadPrefix`); a `MutationObserver` re-applies it
  because Next rewrites `<title>` on navigation.
- The inbox marks unread rows with a bold title and a dot ("Unread" for screen readers), and
  previews the last message (whitespace collapsed, 120 characters, "You: " prefix for your own).
- Mark-read, send, start, and block actions call `revalidatePath('/messages', 'layout')` so the
  inbox reflects them.
- **Times render in the viewer's zone:** `LocalTime` (`app/_components/local-time.tsx`) renders a
  non-breaking space on the server and during hydration, then formats with `formatMessageTime`
  after mount. The placeholder keeps the line height and avoids a hydration mismatch.

## Realtime

Live delivery is a convenience on top of the database, which is the source of truth.

- **Channels:** one private broadcast channel per user, named `user:<clerk user id>`
  (`userTopic`). Event name `message`.
- **Policy:** one policy on `realtime.messages` lets an `authenticated` user `select` only when
  `realtime.topic() = 'user:' || (select auth.jwt() ->> 'sub')` (migration
  `0006_realtime-user-channel-policy.sql`; see `database.md`). There is no insert policy, so
  browsers can listen on their own channel and cannot send.
- **Public access off:** the policy only guards private channels. A public join of `user:<id>`
  is allowed but never receives the server's private broadcasts (`tests/realtime` proves this).
  Production must still turn off the Realtime "Allow public access" setting so every channel
  needs a valid token; see `launch-checklist.md`.
- **Publish (server):** after the transaction commits, `publishToUser`
  (`server/realtime/publish.ts`) creates a Supabase client with `SUPABASE_SECRET_KEY`, opens the
  private channel, and sends with `httpSend` (an HTTP call, no socket kept open), then removes
  the channel. It publishes to the
  recipient and to the sender (so their other tabs update); `publishMessage` also handles a null
  recipient by publishing to the sender only, which is defensive since sends to a deleted account
  are refused first. On failure it throws `Realtime publish failed for <topic>` with the cause.
- **Event shape:** `RealtimeEvent`, which is
  `{ type: 'message', conversationId, message: { id, conversationId, senderId, body, createdAt } }`.
  It never carries the listing, the unit, or a display name.
- **Best-effort:** `publishMessage` runs after commit with `Promise.allSettled`; each failure goes
  to Sentry and nothing is rethrown, so a failed broadcast never fails a committed send.
- **Subscribe (browser):** `MessagingProvider` (in the root layout, inside `ClerkProvider`) calls
  `subscribeToUserChannel` once per signed-in user. It creates a Supabase client with
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and an `accessToken` callback returning the Clerk session
  token (`useAuth().getToken()`), calls `realtime.setAuth()` before joining (otherwise the socket
  carries the publishable key and the private join is refused), and listens for `message`.
  Channel errors and timeouts log a `console.warn` and nothing else.
- **What an event does:** the provider refetches the unread count; an open thread merges the
  message (deduplicated by id) and, if the viewport was at the bottom, follows it; the inbox calls
  `router.refresh()`.
- **Recovery (resync):** on every `SUBSCRIBED` (the first join included, so events committed
  before the join are caught) and on window `focus` or `visibilitychange` to visible (only these
  two are coalesced to one per second), the provider refetches the unread count and emits a
  resync. `ResyncRefresher` then calls `router.refresh()` once, which re-renders the inbox and the
  open thread together; the thread merges the new server window on render (seen messages are
  never dropped) and, if the tab is visible, marks the conversation read. A message missed while
  offline therefore appears on return.
- **One refresher per resync:** `ResyncRefresher` (mounted once in the `/messages` layout) is the
  only resync listener that calls `router.refresh()`. The inbox and thread panel must not refresh
  on resync themselves; each extra listener adds another RSC payload per tab return. Outside
  `/messages` a resync only refetches the unread count.
- **Refresh after a block action:** the thread menu and the composer-area Unblock run their
  action through `useRefreshAfter`, which calls `router.refresh()` once when the result is `ok`.
- **Without the publishable key** (or the Supabase URL), `subscribeToUserChannel` returns null:
  no socket, no live updates. The app still works through refetch on focus and navigation.
- **Auth:** Realtime accepts the Clerk token through Supabase's Clerk third-party auth (see
  `auth.md`).

## Privacy

- The unit appears in the thread header for both participants, and on the listing page for the
  owner, admins, and a renter who has a conversation on that listing. It never appears in the
  inbox, the "new conversation" header, Realtime payloads, Open Graph tags, or cards.
- **Non-participants get 404** on `/messages/[id]`, admins included, and so does a malformed id.
  A "load earlier" request with a cursor from another conversation returns a NotFound error
  result, which the thread shows as "Could not load earlier messages. Try again." (not a 404
  page). Admins read a thread at `/admin/conversations/[id]`, read-only, and each view writes an
  audit row (see `admin.md`).
- Message bodies render as plain text with `whitespace-pre-wrap`; HTML is never interpreted.
- Every thread shows the safety note (`SAFETY_NOTICE`): "Never send money or a deposit before
  seeing the place in person and meeting the tenant."
- Deleted accounts: the other side keeps the thread. The person shows as "Deleted user", their
  messages stay (sender set null), and sending is refused.

## Blocks

- **Block user / Unblock** is in the thread's "Conversation options" menu (the `⋯` button); once
  you have blocked someone, the composer area also shows an **Unblock** button.
- A block hides listings both ways. For a signed-in viewer, browse and search, saved listings,
  and the save action exclude the other user's listings (`noBlockWith`). The listing page is a 404
  for a visitor when either side blocked the other, and "Message host" or starting a conversation
  there is refused. The owner and admins can still open the page.
- **Sending:** a block stops sending in that conversation in both directions (composer states
  above). The history stays readable to both, and unblocking reopens the composer on both sides.
- The thread header links to the listing only when it is public (or the viewer owns it) and no
  block exists in either direction, since the listing page is a 404 to a blocked visitor.
- Blocking is silent: the blocked user gets no notification and sees only the generic "You can't
  reply" text. The server refuses their next send immediately; their open page updates on its
  next refresh or resync.
- **Report user** is in the same menu; **Report message** sits beside each message from the other
  person (not shown for messages whose sender is gone). Both open the report dialog described in
  `moderation.md`.
- `/settings` lists everyone you have blocked with an **Unblock** button.

## Decisions that can look like bugs

- **A conversation row appears only with the first message.** Opening `/messages/new` never
  creates one.
- **Non-participants and admins get 404** on `/messages/[id]`. Admin access is the separate,
  logged `/admin/conversations/[id]`.
- **Deleted other participant:** the thread stays readable; the composer is replaced by "This
  account was deleted" and sending is refused. A **banned** other participant gets the generic
  "You can't reply to this conversation".
- **Paging:** a thread loads the latest 100 messages; "Load earlier messages" fetches 100 more.
  The inbox shows the 100 most recent conversations, with no pagination.
- **Sending marks the conversation read for the sender.**
- **`clock_timestamp()` instead of `now()`** (see Rules).
- **Length is validated in UTF-16 units** (Zod `.max(2000)`), which is never looser than the
  database `char_length` check (code points), so a valid body can never fail the constraint. A
  message of emoji can therefore be shorter than 2,000 characters on screen.
- **Realtime is best-effort** (see Realtime). A failed broadcast is reported to Sentry and never
  fails a send; without the publishable key the browser relies on refetch on focus.
- **Messages cannot be edited or deleted** by users.
- **"Message host" is not shown to the listing's owner** (or admins). Signed out, it is Clerk's
  `SignInButton` in redirect mode.
- **The local Clerk domain is committed** in `supabase/config.toml` (`[auth.third_party.clerk]`).
  It is the dev instance's public Frontend API domain, not a secret.
- **E2E uses two real Clerk test users** (`E2E_CLERK_USER_EMAIL`, `E2E_CLERK_USER2_EMAIL`). The
  listing is seeded and approved by SQL, as in earlier plans.

## Known issues

- **A visible open thread still gets two RSC payloads per resync.** `ResyncRefresher` sends one,
  and the thread's mark-read (`markReadAction`) sends a second because it calls
  `revalidatePath('/messages', 'layout')`, which re-renders the current route in the action
  response. Mark-read needs that revalidation so the inbox drops the unread dot.
