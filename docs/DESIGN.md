---
name: Campus Subleases
description: Student-to-student subleases, each school dressed in its own athletic colors.
colors:
  school: "#15171c"
  school-deep: "#000000"
  on-school: "#ffffff"
  school-secondary: "#ffffff"
  on-school-secondary: "#15171c"
  school-highlight: "#ffffff"
  on-school-highlight: "#15171c"
  school-tint: "#f1f2f4"
  school-link: "#15171c"
  ink: "#15171c"
  ink-2: "#444a55"
  ink-3: "#626977"
  line: "#e2e4e8"
  line-2: "#cdd1d7"
  surface-2: "#f5f6f8"
  background: "#ffffff"
  ok: "#1d6b3a"
  ok-bg: "#e6f2ea"
  warn: "#8a5a00"
  warn-bg: "#fff4d6"
  bad: "#a4161a"
  bad-bg: "#fbe9e9"
typography:
  display:
    fontFamily: "Big Shoulders, Arial Narrow, sans-serif"
    fontSize: "clamp(3.25rem, 7vw, 5.75rem)"
    fontWeight: 900
    lineHeight: 0.92
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Big Shoulders, Arial Narrow, sans-serif"
    fontSize: "clamp(2.75rem, 6vw, 4rem)"
    fontWeight: 900
    lineHeight: 0.92
    letterSpacing: "0.01em"
  title:
    fontFamily: "Big Shoulders, Arial Narrow, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "0.01em"
  title-sm:
    fontFamily: "Big Shoulders, Arial Narrow, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "0.02em"
  numeral:
    fontFamily: "Big Shoulders, Arial Narrow, sans-serif"
    fontSize: "2.375rem"
    fontWeight: 800
    lineHeight: 0.95
    fontFeature: "tnum, lnum"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  lede:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.625
  body-meta:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1
  tag:
    fontFamily: "Big Shoulders, Arial Narrow, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.06em"
rounded:
  tag: "2px"
  md: "0.3rem"
  lg: "0.375rem"
  bubble: "14px"
  full: "9999px"
spacing:
  gutter-sm: "16px"
  gutter-md: "24px"
  gutter-lg: "32px"
  card: "20px"
  card-sm: "12px"
  container: "80rem"
components:
  button-primary:
    backgroundColor: "{colors.school}"
    textColor: "{colors.on-school}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.school-deep}"
  button-highlight:
    backgroundColor: "{colors.school-highlight}"
    textColor: "{colors.on-school-highlight}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-outline-hover:
    backgroundColor: "{colors.surface-2}"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "40px"
  tag:
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    padding: "3px 7px"
  tag-new:
    backgroundColor: "{colors.school-highlight}"
    textColor: "{colors.on-school-highlight}"
    rounded: "{rounded.tag}"
  chip-active-filter:
    backgroundColor: "{colors.school}"
    textColor: "{colors.on-school}"
    rounded: "{rounded.full}"
    height: "32px"
  card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "{spacing.card}"
  school-ribbon-block:
    backgroundColor: "{colors.school}"
    textColor: "{colors.on-school}"
    padding: "20px 20px 0"
    width: "18.75rem"
    height: "12rem"
  school-ribbon-block-hover:
    backgroundColor: "{colors.school-deep}"
---

# Design System: Campus Subleases

## Overview

**Creative North Star: "The Varsity Program"**

Each school's pages wear that school the way its athletic department would: solid fields of the school primary, condensed block caps, jersey numerals, and one stripe in the school's second color. Underneath that dress sits a quiet, white, ink-on-paper marketplace that has to earn trust from students and parents, so the color is concentrated in a few structural places (the header, the browse band, primary actions, the timeline bar, map pins) and everything else stays neutral.

The system is data-driven by design. No school palette lives in code: every school role is a CSS custom property set on `<html>` from the school's `theme` row (see `lib/school-theme.ts` and `docs/design-system.md`). The tokens in the frontmatter for the `school-*` roles are the neutral fallback, which is also what admin and the signed-out landing at `/` wear. Density is moderate and operational: browse is a photo grid beside a sticky map, forms and admin are dense and calm.

The signed-out landing at `/` is neutral ink: an ink header running straight into an ink hero, then white sections below. Its only school color is the School Ribbon, where each block is dressed in its own school's colors (behavior in `docs/site-pages.md`, "Landing page (`/`)").

**Key Characteristics:**

- White ground, ink text, school color as structure rather than decoration.
- Big Shoulders condensed caps for headings and tags; Big Shoulders numerals for rent and counts; Archivo for everything you read.
- One recurring motif: the varsity stripe in the school's secondary color.
- Near-square corners; block-letter tags at 2px.
- Rent is the loudest thing on a listing; dates are drawn, not just written (the term timeline).

## Colors

A neutral ink-and-paper base, with a per-school set of role colors injected at runtime.

### Primary

- **School Primary** (`school`): header bar, browse band, default buttons, active-filter chips, timeline bar, map pins and clusters, selection, focus rings, the rent panel head. Neutral fallback is ink. Launch values: UW–Madison #C5050C, Michigan #00274C, UCLA #2774AE.
- **School Deep** (`school-deep`): hover and pressed state of anything filled with the primary. UW #9B0000, Michigan #001A33, UCLA #005587.
- **On School** (`on-school`): text and icons on primary fields; white for all three launch schools.

### Secondary

- **Varsity Stripe** (`school-secondary`, with `on-school-secondary`): only the stripe, the current-page bar under header nav links, and focus rings inside school-colored regions. UW white, Michigan maize #FFCB05, UCLA gold #FFD100.

### Tertiary

- **Highlight** (`school-highlight`, with `on-school-highlight`): Post a listing and Sign up, the school tag in the header, New tags, unread and count pills, the hovered map pin. Michigan maize on navy text, UCLA gold on #003B5C, UW charcoal #282728 on white (red-and-white has no third color, so UW borrows charcoal).
- **Tint** (`school-tint`): selected rows, expanded filter toggle, avatar discs, empty-state icon discs. UW #FBEDEE, Michigan #EEF2F7, UCLA #EDF4FA.
- **Link** (`school-link`): inline text links and link buttons on white; a darker cut of the primary that passes AA as text (UW #A8040A, Michigan #00396E, UCLA #005587).

### Neutral

- **Ink** (`ink`): body text, headings, the neutral theme's primary, campus marker on maps, admin's 2px header rule.
- **Ink 2** (`ink-2`): secondary text, metadata lines, labels on filters, table headers.
- **Ink 3** (`ink-3`): placeholders, timeline axis labels, hover border on inputs and outline buttons.
- **Line** (`line`): dividers, card rings, empty timeline segments.
- **Line 2** (`line-2`): input and outline-button borders, table header rule.
- **Surface 2** (`surface-2`): footer, filter panel, card footers, empty states, photo placeholders, the incoming message bubble.
- **Status pairs** (`ok`/`ok-bg`, `warn`/`warn-bg`, `bad`/`bad-bg`): listing status tags and destructive actions only.

### Named Rules

**The Colors Are Data Rule.** Never hardcode a school hex in a component. Use the role (`bg-school`, `text-on-school`, `bg-highlight`); to dress one element in a different school, spread `schoolThemeStyle(theme)` into its style. Map layers read the same custom properties at runtime.

**The Paired Text Rule.** Every fill role has an `on-*` partner, and text on that fill uses it. Each pairing must pass WCAG AA for every school; check before adding one.

**The Scarce Highlight Rule.** The highlight color marks only the call to post, counts, New tags, the school tag, and the hot map pin. It is never a background for a section.

## Typography

**Display Font:** Big Shoulders (variable, optical-size axis; fallback Arial Narrow, sans-serif)
**Body Font:** Archivo (fallback system-ui, sans-serif)

**Character:** Big Shoulders is the scoreboard and the jersey: condensed, upright, all caps for headings and tabular for figures. Archivo is a sturdy grotesk that keeps forms, metadata, and messages plain and readable.

### Hierarchy

- **Display** (900, clamp(3.25rem, 7vw, 5.75rem), 0.92): the school short name in the browse band only. It is visual; the real `h1` is screen-reader text beside it. The one documented exception is the landing hero headline: clamp(3.25rem, min(9.5vw, calc(40svh − 14rem)), 8.5rem) at 0.88 leading, capped at 19ch. Viewport height drives it so the School Ribbon always stays in the first viewport (about 136px at 1440×900, about 96px at 1280×800).
- **Headline** (900, clamp(2.75rem, 6vw, 4rem), 0.92): page `h1` on content pages; the listing title runs a step smaller (clamp(2.25rem, 4.4vw, 3.5rem)); admin page titles are a fixed 2.5rem.
- **Headline (landing)** (900, clamp(2.5rem, 5vw, 4rem), 0.92): section `h2`s on the landing page.
- **Title** (800, 1.75rem): section headings on the listing page (About this place, Availability, Amenities, Location). Card and admin section titles use **Title SM** (800, 1.375rem, 0.02em).
- **Numeral** (800, tabular lining figures, 0.95): rent on tiles (2.375rem), rent in the listing panel (3.75rem), stat counts in the band; at 12px inside count pills. The landing's step numerals reuse the 3.75rem size.
- **Lede** (Archivo 400, 17px, 19px from 640px, relaxed 1.625 leading): the landing hero's sentence under the headline, white at 88% on ink, capped at 48ch; the landing's section intros use it at 17px in ink-2.
- **Body** (400, 15px, 1.5): default text. Static/legal pages and landing body copy read at 16px with relaxed leading, capped near 52–70ch.
- **Body meta** (13px, ink-2): facts lines, distance and dates, "/ month".
- **Label** (600, 13px): form labels; buttons are 600 at 14px (13px small, 15px large).
- **Tag** (Big Shoulders 700, 12px, 0.06em, uppercase): block-letter tags and timeline term labels; table headers and definition-list terms use the same face at 0.08em in ink-2.

### Named Rules

**The Caps Are Display Rule.** Uppercase belongs to Big Shoulders only (the `varsity` treatment). Archivo is always sentence case.

**The Rent Is A Numeral Rule.** Money and counts render in the `numeral` treatment with tabular figures, never in Archivo bold.

Text selection is the school fill with on-school text; on ink regions (the landing hero and closing band) it inverts to white with ink text.

## Layout

One centered container (80rem max) with gutters of 16px, 24px from 640px, 32px from 1024px; the header, band, filter bar, content, and footer all share it so edges line up. The header is a 64px school-colored bar. Browse is a two-column split from 768px: listing grid on the left, map sticky on the right below the filter bar (which is itself sticky from 768px); on phones the map stacks at 70dvh. Listing detail is content left with a sticky rent panel right from 1024px. Settings, the listing form's step nav, and admin side panels use the same sticky-side pattern at `top: 24px`. Long-form text caps at 52–70ch. Controls share a 40px height (36px small, 48px large); fields in the filter panel sit on a 4-column grid at 1024px, 2 at 640px.

The signed-out landing opens with an ink hero that fills the first viewport below the header (min-height min(100svh − 4rem, 58rem)): headline, lede, and call to action at the top of the container, the School Ribbon pinned to the hero's foot. The ribbon's label line sits in the container; the ribbon row itself runs full-bleed. Below the hero the landing alternates white and surface-2 sections on the shared container (80px vertical padding, 96–112px from 1024px), and closes with an ink call-to-action band.

Desktop-first; every public surface works at 390px. Admin is desktop-only and uses a sticky left nav.

## Elevation & Depth

Mostly flat with tonal layering: white surfaces separated by 1px lines and the surface-2 gray. Shadows are ambient and rare, used where an element floats over imagery or the page.

### Shadow Vocabulary

- **Panel at rest** (`box-shadow: 0 6px 24px rgb(21 23 28 / 0.07)`): the listing rent panel and similar raised summary panels.
- **Dialog** (`box-shadow: 0 20px 60px rgb(0 0 0 / 0.3)` over an ink/60 backdrop): report dialog; the photo gallery uses 0.35 over ink/70.
- **Over photo** (`box-shadow: 0 1px 4px rgb(0 0 0 / 0.18)`): the favorite button sitting on a tile photo.
- **Highlight lift** (`0 1px 2px rgb(0 0 0 / 0.12)`, hover `0 2px 10px rgb(0 0 0 / 0.2)`): the highlight button only.
- **Map halo** (`0 0 0 3px #fff`): white ring that lifts markers off map tiles.

### Named Rules

**The Line Before Shadow Rule.** Separate with a 1px line or a surface-2 field first; reach for a shadow only when something floats over a photo, a map, or the page.

## Shapes

Near-square. Controls, cards, inputs, photos, and panels use a tight 0.3rem corner (Tailwind `rounded-md`); tags, the header school tag, map labels, and pins use 2px so they read as block letters. Fully round is reserved for small, single-purpose objects: active-filter chips, the More filters toggle, count pills, the favorite button, avatars, icon discs, and the listing pin dot. Message bubbles are the one soft form: 14px corners with the sender-side bottom corner pinched to 3px.

The varsity stripe is the signature form: two 4px rules in the secondary color 13px apart, drawn full-width under the browse band. At the foot of the header (non-browse pages) and inside the rent panel head it appears as a single 4px rule. The signed-out landing drops the header stripe so the ink header runs into the ink hero; there the double stripe appears at the foot of each School Ribbon block instead.

## Components

### Buttons

Firm, compact, and colored by role.

- **Shape:** gently squared (0.3rem), 600 weight, 40px default height; `active` nudges down 1px.
- **Primary (default):** school fill, on-school text; hover to school-deep.
- **Highlight:** highlight fill with its pair text and a faint lift; reserved for Post a listing and Sign up. On the neutral landing it reads white on ink, and the two account calls run large (52px, 16px text, 24px padding).
- **On School:** transparent with a 55%-opacity on-school border, for secondary actions inside the header; hover adds a 10% white wash.
- **Outline / Ghost / Destructive / Link:** outline is white with a line-2 border that darkens to ink-3 on hover over surface-2; destructive is a bad-tinted fill with bad text; link uses `school-link` and drops its underline on hover.
- **Focus:** a 3px school-colored outline, 2px offset, site-wide; inside school-colored regions (`on-school`) the ring switches to the secondary color.

### Chips

- **Active filters:** 32px fully round school-filled chips with an X; each is a link that removes that filter; hover to school-deep.
- **Toggle (More filters):** 40px round outline chip; when expanded, school border on school-tint, with a numeral count pill.

### Tags

Block-letter labels (Big Shoulders 700, 12px caps, 2px corners, min 22px tall). Status tones: neutral (surface-2 with line-2 ring), warning, danger, success from the status pairs. New uses the highlight pair. Long text (a rejection reason) wraps rather than truncating.

### Cards / Containers

- **Corner Style:** 0.3rem.
- **Background:** white, with a 1px line ring rather than a border; footers on surface-2 with a top line.
- **Shadow Strategy:** none at rest (see Elevation).
- **Internal Padding:** 20px, 12px for the small size. Card titles are Title SM in caps.

### Inputs / Fields

- **Style:** 40px, white, 1px line-2 border, 0.3rem corners, ink-3 placeholder; hover border to ink-3.
- **Focus:** school border plus a 3px school ring at 20%.
- **Error / Disabled:** destructive border and 20% destructive ring; disabled at 50% opacity.
- **Labels:** 13px Archivo 600 in ink, above the field.

### Navigation

- **Header:** school-colored 64px bar. Brand is the app name in Big Shoulders 900 caps with the school short name as a small highlight tag. Links are 14px Archivo 500 on-school, a 10% white wash on hover; the current page goes bold with a 4px secondary-color bar along the header's bottom edge. Below 768px the links collapse into a menu.
- **Footer:** surface-2 band with a top line, the unaffiliated statement left and plain ink links right.
- **Admin:** neutral theme, sticky left nav, page headers closed by a 2px ink rule.

### Listing Tile

4:3 photo with 0.3rem corners and a slow 1.035 zoom on hover (500ms, expo-out), New tag top-left, favorite top-right; below it the rent numeral with "/ month", the title (underlines on hover), a facts line, distance and dates, and the compact term timeline.

### Term Timeline

The stay drawn to scale on a shared 12-month axis of three four-month terms (Jan–Apr, May–Aug, Sep–Dec), starting at the term containing the page's earliest move-in so every card compares. Compact: an 8px bar over line-gray segments with caps term labels, the active term in ink. Full (listing page): 32px segments on surface-2 with month ticks and the date range written inside the school bar.

### School Band

The browse page's hero: school field, the short name at Display size, a sub-line naming the campus and city, a count aside right, closed by the full double stripe.

### School Ribbon

The landing's roll call of schools, and its one authored motion: one solid school-primary block per active school, read from data so it scales to any number of schools, each block dressed with `schoolThemeStyle(theme)`.

- **Block:** 16.5rem × 10rem on phones, 18.75rem × 12rem from 640px, 20px padding on top and sides, separated by 6px gaps that show the ink beneath. Square corners.
- **Content:** school short name in Big Shoulders 900 caps (2.25rem, 2.75rem from 640px); a 14px line with the city left and "Browse" plus an arrow right (600); the full double varsity stripe in the school secondary at the block's foot, 16px up from the bottom edge.
- **States:** hover deepens to school-deep (300ms) and nudges the arrow 2px right; focus draws the ring inset (−4px offset) in the school secondary.
- **Motion:** the row drifts left at 32px/s by moving `scrollLeft`, looping through repeated copies (repeats are hidden from the tab order and accessibility tree). It pauses while hovered, focused, touched, or the tab is hidden, and with a Pause / Play button (36px, white/55% border, on-school treatment) beside the label line. Paused, the row shows a thin white/45% scrollbar so it can be scrolled by hand; playing, the scrollbar is hidden. Under reduced motion it renders as a still auto-fit grid of the same blocks with no Pause button.

### Map Pins

Rent pills (rounded 3px, with a pointer) in the school primary, the hovered pin in the highlight pair; clusters are school circles with a 3px white stroke; the campus marker is an ink 2px square with a white halo and a caps label. All colors are read from the page's custom properties.

## Do's and Don'ts

### Do:

- **Do** take every school color from its role token; dress single elements with `schoolThemeStyle(theme)`.
- **Do** put text on a school fill in its `on-*` partner, and check AA for each school.
- **Do** set headings, tags, and table headers in the Big Shoulders caps treatment, and rent and counts as tabular numerals.
- **Do** keep corners tight: 0.3rem for controls and surfaces, 2px for tags and map labels.
- **Do** use the varsity stripe as the one recurring motif: double under the browse band, single at the header foot and the rent panel head.
- **Do** align every band and section to the shared 80rem container and its gutters.

### Don't:

- **Don't** hardcode a school's hex, or add logos, seals, wordmarks, or mascots; schools are identified by color and name only.
- **Don't** use the highlight color as a section background or for ordinary buttons.
- **Don't** set Archivo in all caps, or set body copy in Big Shoulders.
- **Don't** add new shadow values; use the vocabulary above.
- **Don't** ship moving content that cannot be stopped; anything that drifts follows the School Ribbon's rules (pause on hover, focus, touch, hidden tab, and a button; still under reduced motion).
