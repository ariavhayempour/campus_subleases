# Listings

## Lifecycle

- New listings start `review_status = pending`; only admins approve (plan 5). Locally,
  `pnpm dev:approve-listing <id>` approves a listing in the local database only.
- Owner status: `active` → `taken` (sets `taken_at`) or `removed`; either can be reactivated.
  An `active` listing whose `available_to` is before today (school timezone) is **expired**.
- Reactivation does not re-check dates: a past-dated listing that is reactivated just stays
  expired (not public). The `available_to ≥ today` check (school timezone) runs on create, and on
  edit only when `availableTo` changes.
- **School and type are fixed after creation** (owner decision). `updateListing` rejects a
  `schoolId` or `type` that differs from the stored row with a `ValidationError` on that field
  ("This can't be changed — delete the listing and post a new one"). The edit form shows both as
  disabled selects (values submitted via hidden inputs) with the hint "To change this, delete the
  listing and post a new one." The create form is unchanged.
- **Public** = active + approved + not expired + owner active + school active
  (`isPublicListing` in `server/services/listing-sql.ts`). Signed-in viewers also never see
  listings when a block exists in either direction.

## Rules (enforced in `server/services/listings.ts`)

- **Cap:** at most 2 listings that are active, `pending`/`approved`/`hidden`, and not expired
  (`countsTowardCap`).
- **Rate limits:** 5 new listings per rolling 24 h (listings table); 20 photo uploads per rolling
  hour, counted from objects under `listings/{userId}/` in the `uploads` bucket created in the
  last hour.
- **Limit-check order:** photo processing (sharp) is the expensive step, and raw uploads survive a
  failed save, so a rejected save could otherwise be replayed to re-run sharp. `createListing`
  pre-checks both the cap and the 5/day limit before processing. `updateListing` pre-checks the
  cap before processing when the save makes the listing count toward it again (for example
  resubmitting an active `rejected` listing). Every save then re-checks inside the save
  transaction, which takes a per-owner advisory lock (`pg_advisory_xact_lock`) so concurrent
  saves cannot both pass. Status changes (reactivation) run the same locked check.
- **Known gap:** the 5/day limit counts surviving rows only, so delete-and-recreate is not
  limited. Hardening is planned for plan 6.
- **Upload limit is best-effort.** It counts stored objects only, so uploads deleted on save,
  parallel requests, and hoarded unused signed URLs can all bypass it. Bucket size caps and the
  listing limits still bound the damage. Hardening needs an issuance record (a migration) and is
  planned for plan 6.
- **Re-review:** title, description, rent, gender preference, address/city/state/ZIP, location,
  unit, or adding a photo → `pending` (clears `review_note`). Removing or reordering photos,
  dates, rooms, roommates, private bathroom, furnished, amenities, and status changes keep the
  current review status. School and type can't change on edit, so they need no re-review. The 20/hour upload limit and the "any added photo" re-review rule are
  owner decisions that differ from the design spec. Editing a `rejected` listing always
  resubmits it; a `hidden` one stays hidden. "Resubmit" in `/me/listings` is the edit flow.
- **Stale edits:** `updateListing` re-reads the listing (`FOR UPDATE`) and its photo ids inside
  the transaction and throws `Conflict` if the review status or photo set changed since the edit
  began (for example an admin hid the listing). Sharp work stays outside the transaction.
- **Normalization:** `private_bathroom` is NULL unless `type = room`; gender preference is forced
  to `any` unless the space is shared (`room` or roommates > 0); blank unit → NULL.
- Non-owners get `NotFound` (not `Forbidden`) for edit, status, and delete. A malformed
  (non-UUID) id in `setListingStatus` gets `ValidationError`; it reveals nothing about existence.
- **Storage cleanup after commit is best-effort.** Raw uploads, removed photos, and a deleted
  listing's photos are deleted via `bestEffort`, which reports failures to Sentry. A storage
  failure never fails a committed save; leftovers are removed by the planned daily cleanup cron
  (plan 6). If the save itself fails, the newly processed photos are deleted instead.

## Unit privacy

`getListingDetail` returns `unit` only to the owner, admins, and a renter with a conversation on
that listing. It is never in Open Graph tags, cards, or `/me/listings`.

## Distance

The form warns (non-blocking) when the address is farther than the school's `warn_radius_km`
using a browser-side haversine (`lib/geo.ts`). Stored and displayed distances use PostGIS
`ST_Distance`; the two differ by under 0.5%.

## Decisions that can look like bugs

- `NEXT_PUBLIC_SUPABASE_URL` is also used server-side for Storage (`server/storage/client.ts`).
- Deleting a user leaves their photo files until the plan-6 cleanup cron.
- Listing E2E seeds rows via SQL; the create form is verified manually.
- Locally, address search uses the Mapbox default public token, which has no URL restriction
  (creating a restricted token needs a card on the account). Production should get a
  URL-restricted token later.

## Pages

`/listings/new`, `/listings/[id]/edit` (owner), `/me/listings` (owner; `?notice=` banners),
`/[school]/listings/[id]` (public when public; `noindex`; Open Graph without the unit).
