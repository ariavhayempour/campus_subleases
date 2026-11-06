# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

College students subleasing their own apartment, house, or room to other students, and students
looking for a sublease near campus (summer internships, study abroad, a semester away). Students
only; no landlords or property managers. Admins (the owner) review every listing and moderate.

## Product Purpose

Campus Subleases (campussubleases.com) is a free, website-only marketplace where a student posts
their place and another student finds it, messages the host in-app, and arranges the sublet.
Success per school: listings posted, share of approved listings that get a message, median time to
the host's first reply, listings marked taken.

## Positioning

Student-to-student only, per school: each school is its own market with its own campus, map, and
colors. Every listing is reviewed by a person before it goes public. Free, with no payments or
escrow.

## Operating Context

- Launch schools: UW–Madison (`uw-madison`), University of Michigan (`umich`), UCLA (`ucla`). New
  schools are data, not code.
- Desktop-first (≥1024px) and usable down to phone width, because shared links open on phones.
  Admin is desktop-only.
- Students pick a home school once, at account creation. When signed in they land on that school's
  browse page and see its colors; students cannot switch schools (other schools' browse pages
  redirect to their own) and can post only to it. Admins switch schools freely with the dropdown on
  the browse page. Non-admins have one live listing at a time; admins have no limit.
- Signed-out visitors start at the landing page on `/`, which explains the platform, names the open
  schools, and points to sign-up. They can browse any school's pages view-only; saving, messaging,
  and posting need an account. (Owner decision 2026-11-05.)

## Capabilities and Constraints

- Browse per school: keyword search, filters (rent, dates, bedrooms, type, furnished, private
  bath, max roommates, gender preference, amenities, distance to campus), sort, map with pins and
  "Search this area", 24 per page with "Load more".
- Listing detail: gallery (1–10 photos), all fields, street address (unit only to people in a
  conversation with the host), map pin, distance to campus, host display name ("First L.") and
  join date, favorite, report, Message host.
- Create / edit listing: school, address (Mapbox autocomplete), details, photos. Every new listing
  goes to admin review, usually live within 24 hours. Max 2 active listings per student.
- In-app messaging with live delivery, an unread count, block and report, and a pinned safety
  notice.
- Favorites, my listings with status and review badges, settings (blocked users, delete account,
  Clerk profile).
- Admin: overview, listing review queue, reports, users, conversations, audit log, trial stats.
- Never: social sign-in, school-email verification badges, payments, reviews or ratings, a mobile
  app.

## Brand Commitments

- The name is "Campus Subleases", read from the `APP_NAME` constant, and must not reference any
  one school.
- Each school's pages use that school's colors: UW–Madison red and white, Michigan maize and blue,
  UCLA blue and gold. The primary color carries structure (header, key accents) and the secondary
  color (maize, gold) appears as deliberate highlights.
- Not affiliated with any university, and the site says so. School colors only; no university
  logos, wordmarks, seals, or mascots.
- Voice: plain, friendly, student-to-student; professional and trustworthy, never hype.

## Evidence on Hand

No real listings, photos, testimonials, or usage numbers yet. Mockups may use labeled sample
listings; never present invented counts or testimonials as real.

## Product Principles

1. Find a place fast: the browse page is the product; every page should lead back to it.
2. Trust through clarity: who the host is, what review means, and safety guidance stay visible.
3. Your school, your colors: the site should feel like it belongs to the student's campus.
4. Clean over clever: professional enough that parents and hosts trust it, friendly enough that
   students use it.

## Accessibility & Inclusion

WCAG AA contrast across all three school palettes, including text on maize and gold. Keyboard
navigable; filters and map have non-pointer paths.

## Open Decisions

- Home-school lock is built. A student who opens another school's listing link can view it but not
  message, save, or report it.
