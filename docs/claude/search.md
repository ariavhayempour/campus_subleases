# Browse, search, and favorites

## Browse page (`/[school]`)

- Public, indexable. Server component: parses the URL into `SearchFilters`
  (`parseSearchParams` in `lib/validation/search.ts`), then calls `searchListings` (24 cards)
  and `searchMapPins` (up to 500 pins) in parallel.
- **Filter state lives in the URL.** Parameters: `q`, `rentMin`, `rentMax` (whole dollars),
  `from`, `to`, `beds`, `type`, `furnished=1`, `privateBath=1`, `maxRoommates`, `gender`,
  `amenity` (repeated), `maxKm`, `bbox=west,south,east,north`, `sort`. The filter form uses the
  same field names, so form data and URLs parse with the same function. `toSearchParams` writes
  canonical URLs (blank fields dropped, default sort omitted).
- **Invalid parameters are ignored** one by one (hand-edited or stale links never error). A max
  rent below the min drops the max; a move-out before the move-in drops the move-out. Services
  validate strictly with `searchFiltersSchema`.
- Filters apply on "Apply filters"; the sort applies on change. "Best match" (relevance) is
  offered and is the default only when `q` is set. An explicitly chosen sort is kept; an
  untouched one follows the default, so adding a keyword switches it to "Best match".
- **Load more** calls `loadMoreListingsAction` with the canonical query string and an offset. It
  is not in the URL, so a reload shows the first page. Offsets use a stable tiebreak
  (`created_at desc, id`); the client skips cards it already shows.
- **Map** (`browse-map-view.tsx`): Mapbox GeoJSON source clustering; pins for all matching
  results (not only loaded cards); hovering a card highlights its pin unless the pin is inside a
  cluster; clicking a pin opens a popup for every listing at that point: a mini-card (cover,
  rent, title) for one, or "N listings here" with rent and title links for several. Panning never
  re-queries; "Search this area" writes `bbox` (rounded to 5 decimals). The map stays mounted
  across filter changes, so filter changes do not count as new Mapbox map loads. Without
  `NEXT_PUBLIC_MAPBOX_TOKEN` (CI) the pane shows "Map unavailable".
- Below 768px a "Show map / Show list" toggle switches panes.

## Search rules (`server/services/search.ts`)

- Starts from the shared public predicate (`isPublicListing`) plus `noBlockWith(viewer)` for
  signed-in viewers (blocks in either direction), restricted to the school.
- Keyword: `search_vector @@ websearch_to_tsquery('english', q)`; relevance =
  `ts_rank` (title weight A > description B > address C).
- Dates: a listing matches when `[available_from, available_to]` overlaps the requested range,
  inclusive on both ends; either end may be open.
- **Bedrooms is an exact count**; the "4+" option means 4 or more. (Owner-visible decision; the
  spec only says "bedrooms".)
- **Private bathroom** matches rooms with `private_bathroom = true` and whole apartments/houses
  with no roommates (their `private_bathroom` is NULL by design).
- Gender: a chosen preference matches listings with that value or `any`.
- Amenities: must have all selected (`amenities @> …`).
- Distance: `ST_DWithin(location, campus, km * 1000)`; map area: `location::geometry &&
ST_MakeEnvelope(…, 4326)`.
- **Cards and pins never include the unit or street address** (`CARD_COLUMNS` in
  `listing-cards.ts` is the only card projection).

## Favorites (`server/services/favorites.ts`)

- `setFavorite(actor, { listingId, favorited })`: saving requires the listing to be visible to
  the viewer (public, no block), else `NotFound`; owners may save their own. Unsaving always
  works. Both directions are idempotent.
- `/me/favorites` lists only listings currently visible to the viewer, most recently saved
  first. A saved listing that stops being public drops out and returns if it becomes public
  again; the `favorites` row is kept.
- `FavoriteButton` is icon-only on listing tiles (accessible name "Save listing", with
  `aria-pressed`) and shows text on the listing detail page (name "Save"/"Saved"). Signed out, it
  is Clerk's `SignInButton` (redirect mode), which returns to the current page after sign-in.

## Decisions that can look like bugs

- Two "Clear filters" links can appear when filters match nothing (bar + empty state).
- Pins are capped at 500 (newest first); the list count can exceed the pins shown.
- "Load more" state is lost on reload by design.
- Several listings in one building share one pin; clicking it lists them all.
