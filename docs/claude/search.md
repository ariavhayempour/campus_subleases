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
  offered and is the default only when `q` is set. A chosen sort that is not the default is kept;
  an untouched one (or one equal to the default) follows the default, so adding a keyword switches
  it to "Best match".
- The filter form is uncontrolled and remounts (`key={query}`) on every new search, which is how
  "Clear filters" and Back/Forward show the fields for the URL. To keep keyboard focus across
  that remount, the form remembers the `id` of the focused control when it navigates and focuses
  the same control after mounting.
- **Load more** calls `loadMoreListingsAction` with the canonical query string and an offset. It
  is not in the URL. Offsets use a stable tiebreak (`created_at desc, id`); the client skips
  cards it already shows. A rejected action (network failure) shows the same inline error as a
  failed result.
- **Restoring loaded cards** (`browse-results.tsx`): after each "Load more" the card count and
  list height are saved in `sessionStorage` under `browse-loaded:<schoolId>:<query>`. When the
  results mount with a remembered count above the first page (Back from a listing, or a reload),
  they fetch the missing pages through the same action, stopping at the remembered count, at the
  end of the results, or on a failed or empty page, then save the count actually shown. The
  remembered height is reserved as a `min-height` before the fetch so the browser's own scroll
  restoration on Back lands at the old position; no scroll code is involved. On a reload the
  cards come back but the scroll position may not. Blocked storage means no restore.
- **Map** (`browse-map-view.tsx`): Mapbox GeoJSON source clustering; pins for all matching
  results (not only loaded cards); hovering a card, or focusing its link with the keyboard,
  highlights its pin unless the pin is inside a cluster; clicking a pin opens a popup for every
  listing at that point: a mini-card (cover, rent, title) for one, or "N listings here" with rent
  and title links for several. Panning never re-queries; "Search this area" writes `bbox`
  (clamped to valid longitudes/latitudes, since a map zoomed out past one world reports
  longitudes beyond ±180, then rounded to 5 decimals). A popup whose listings are all filtered
  out is closed for good. The map stays mounted across filter changes, so filter changes do not
  count as new Mapbox map loads. Without `NEXT_PUBLIC_MAPBOX_TOKEN` (CI) the pane shows "Map
  unavailable".
- Below 768px a "Show map / Show list" toggle switches panes.
- **Phone map mount** (`browse-view.tsx`): `useMediaQuery('(min-width: 768px)')`
  (`app/_lib/use-media-query.ts`, `useSyncExternalStore` over `matchMedia`, `false` on the
  server) decides whether the viewport is desktop. Desktop always mounts the map, and once
  mounted it stays mounted if the window later shrinks below 768px. Below 768px
  Mapbox is not loaded until the first "Show map"; after that the map stays mounted while the
  toggle switches panes. A URL with `bbox` opens on the map pane (and mounts it), since the
  user came for that area. Until the map mounts, the pane holds a grey placeholder; because the
  server snapshot is `false`, desktop also shows the placeholder until hydration.
- **Tile markup**: the tile title is an `<h2>` (the page `<h1>` is the only heading above it, on
  both `/[school]` and `/me/favorites`).

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
  again; the `favorites` row is kept. The page shows at most the 200 most recently saved
  listings and has no paging.
- `FavoriteButton` is icon-only on listing tiles and shows text ("Save"/"Saved") on the listing
  detail page. Both variants name their listing (`listingTitle` prop): `Save “{title}”` when
  unsaved, `Remove “{title}” from saved` when saved. Each name contains the visible text, so
  voice control still matches it. There is no `aria-pressed`, since the name already states the
  action. Signed out, it
  is Clerk's `SignInButton` (redirect mode), which returns to the current page after sign-in.
  A failed or rejected save rolls the heart back and shows a visible `role="alert"` message
  (a small bubble under the heart on tiles, a line under the button on the detail page).

## Decisions that can look like bugs

- Two "Clear filters" links can appear when filters match nothing (bar + empty state).
- Pins are capped at 500 (newest first); the list count can exceed the pins shown.
- "Load more" progress is remembered per search for the browser session, so returning to a
  search already paged through (Back, reload, or applying the same filters again) shows the
  extra cards again after a moment.
- Several listings in one building share one pin; clicking it lists them all.

## Deferred

Known gaps, left for after launch:

- Accessibility: map pins are not keyboard-reachable; filter checkboxes lose focus after "Apply
  filters" (the remounted form restores focus by control `id`, and the checkboxes have none).
- Performance: the pin payload carries title and cover for up to 500 pins; the `bbox` filter
  casts to `geometry`, so it cannot use the `geography` GiST index; toggling a heart may re-run
  the browse queries.
- Load-more restore: it is uncapped (a remembered count of hundreds fetches every page), and a
  failed restore is silent (the list just stops at what loaded).
- Small browse behaviours: owners see no Save button on their own listing's page; a keyword
  made only of stop words matches nothing; no "Search this area" prompt appears after a cluster
  zoom; how "More filters" opens and closes across searches is not settled; Back/Forward do not
  restore the map camera.
