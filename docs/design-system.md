# Design system and school theming

The UI follows the "Varsity Program" direction: each school's pages wear that school's colors, in
the way a school applies its athletic graphic standards. Product facts and brand rules live in
`PRODUCT.md` (same folder); the direction contract lives in `.impeccable/surfaces/app.md`.

## School colors are data

`schools` carries the branding (migration `0009_school-branding.sql` adds the columns,
`0010_school-branding-seed.sql` fills the launch schools):

| column        | use                                                                |
| ------------- | ------------------------------------------------------------------ |
| `short_name`  | the name in the school band, header tag, and cards ("Michigan")    |
| `city`        | the band's sub-line ("Ann Arbor, MI")                              |
| `campus_name` | distances read "to {campus_name}" ("the Diag")                     |
| `theme`       | jsonb, `SchoolTheme` in `lib/school-theme.ts` (validated with Zod) |

All four are nullable. A school added without them still works: `schoolBrand()` in
`server/services/schools.ts` falls back to the full name, "campus", and `NEUTRAL_THEME`, and a
malformed `theme` also falls back to neutral (tested in `tests/services/schools.test.ts`).

`SchoolTheme` fields: `primary` (header, band, primary buttons, pins), `primaryDeep` (hover),
`secondary` (the varsity stripe), `highlight` (Post a listing, counts, rent tags; Wisconsin uses
charcoal), `tint` (selected rows), `link`, and an `on*` text color for each fill. Every `on*`
pairing must pass WCAG AA; check new schools before adding them. No logos, seals, or mascots,
only colors.

Adding a school = one custom migration with the `INSERT` plus its branding values.

## Which school a page wears

`resolveThemeSchool()` (`lib/theme-school.ts`, tested in `tests/lib/theme-school.test.ts`):

1. A route whose first segment is a school slug (`/umich`, `/umich/listings/…`) wears that school.
2. `/admin/**` and the landing page `/` stay neutral (ink); the landing page dresses each block of
   its school ribbon in that school's colors with `schoolThemeStyle`.
3. Anything else wears the signed-in viewer's home school; visitors without one get neutral.

The colors reach CSS as custom properties (`--school`, `--on-school`, `--school-secondary`,
`--school-highlight`, …) set on `<html>`:

- **First paint (server):** `proxy.ts` copies the request path into the `x-pathname` header
  (`lib/request-headers.ts`); the root layout's `getThemeContext()` (`app/_lib/theme-school.ts`)
  resolves the school and renders the style on `<html>`, so there is no flash of the wrong
  colors. Reading headers makes every page dynamically rendered, including the static pages.
- **Client navigation:** the root layout stays mounted across navigations, so
  `SchoolThemeProvider` (`app/_components/school-theme.tsx`) re-resolves on every path change
  and rewrites the properties. `useThemeSchool()` gives components the current school.

To make one element wear a specific school (onboarding cards, admin swatches), spread
`schoolThemeStyle(theme)` into its `style`.

## Tokens (`app/globals.css`)

Tailwind colors: `school`, `school-deep`, `on-school`, `school-secondary`, `on-school-secondary`,
`highlight`, `on-highlight`, `school-tint`, `school-link`, `ink`, `ink-2`, `ink-3`, `line`,
`line-2`, `surface-2`, `ok`/`warn`/`bad` (+ `-bg`). The shadcn variables (`--primary`, `--ring`,
`--border`, …) point at these, so stock components follow the school.

Classes: `varsity` (condensed block caps), `numeral` (display-face tabular numerals for rent and
counts), `varsity-stripe` (the double rule in the secondary color, the one recurring motif),
`on-school` (marks a school-colored region so focus rings switch to the secondary color).

Fonts (`next/font/google`, no package): Big Shoulders (variable, optical-size axis) for display
and numerals, `--font-display`; Archivo for body and UI, `--font-sans`.

## Shared components

| component                                 | what it is                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `site-header.tsx` + `header-brand.tsx`    | school-colored bar, school tag, nav, Post a listing, stripe                                         |
| `header-nav.tsx`                          | Browse, Saved, My listings, Settings; the current page gets `aria-current` and a stripe-color bar   |
| `account-menu.tsx`                        | initials avatar in school colors: Settings, Clerk profile, Sign out (replaces Clerk's `UserButton`) |
| `school-band.tsx`                         | the browse page's school-name band (visible name; sr-only h1)                                       |
| `listing-tile.tsx`                        | photo (4:3), rent numeral, facts, distance + dates, timeline                                        |
| `term-timeline.tsx` (`lib/term-timeline`) | the stay drawn to scale on a shared 12-month axis                                                   |
| `listing-badge.tsx` (`Tag`)               | block-letter status tags (Live, Pending review, Rejected: …)                                        |
| `[school]/_components/active-filters.tsx` | one removable school-colored chip per active filter (`lib/active-filters.ts`)                       |

The timeline is a twelve-month axis of three four-month blocks (Jan–Apr, May–Aug, Sep–Dec), each
labeled with its year. Browse and Saved pass today's date as `axisStart`, so every card shares one
axis and bars compare; the listing and admin detail pages anchor the axis at the stay's own
move-in. Stays that start before or run past the axis are clamped (the detail page says so).

Cards show a NEW tag (highlight color) when the listing was approved within the last 7 days
(`ListingCard.isNew`, computed from `reviewed_at` in `server/services/listing-cards.ts`).

Buttons (`components/ui/button.tsx`): `default` (school), `highlight`, `onSchool` (outline on a
school-colored surface), `outline`, `ghost`, `destructive`, `link`; sizes default 40px, `sm`
36px, `lg` 48px.
