# Campus Subleases

A website where college students sublease their own apartment, house, or room to other students.
Students only (no landlords), free, and web only. Desktop-first and responsive down to phone
width; the admin area is desktop-only. Live at [campussubleases.com](https://campussubleases.com).

It launches with UW–Madison, University of Michigan, and UCLA. New schools are data, not code.

## Features

- Browse and search listings by school with filters, sorting, and a map
- Post, edit, and manage listings with photos; every listing is reviewed before it appears
- Save favorite listings
- Private messaging between students with live delivery, plus blocking
- Reporting, automatic hiding of heavily reported listings, and an admin area for review,
  moderation, and an audit log
- Static pages (about, terms, privacy, contact), `robots.txt`, and a sitemap

## Tech stack

- TypeScript (strict), Next.js App Router on Vercel (incl. Vercel Cron), Node 22+, pnpm
- Clerk for auth
- Supabase Postgres + PostGIS through Drizzle ORM; Supabase Storage and Realtime
- Mapbox for maps and address search
- Tailwind CSS and shadcn/ui; Zod for validation; Sentry for error monitoring
- Vitest (service tests against a real local Postgres) and Playwright (E2E)

## Getting started

You need Node 22+, pnpm, and Docker (for the local Supabase stack via the Supabase CLI).

```bash
pnpm install
cp .env.example .env.local   # then fill in the values; see docs/claude/environment.md
pnpm db:start                # local Supabase (Postgres, Storage, Realtime) and storage buckets
pnpm db:migrate              # apply migrations
pnpm dev                     # http://localhost:3000
```

Clerk and Mapbox need real keys from their dashboards. New listings wait for review, so locally
run `pnpm dev:approve-listing <listing-id>` to approve one (it refuses non-local databases).

## Scripts

| Command                     | What it does                                     |
| --------------------------- | ------------------------------------------------ |
| `pnpm dev`                  | Dev server                                       |
| `pnpm build` / `pnpm start` | Production build / serve it locally              |
| `pnpm lint`                 | ESLint                                           |
| `pnpm typecheck`            | `next typegen` and `tsc --noEmit`                |
| `pnpm format`               | Prettier (`pnpm format:check` to only check)     |
| `pnpm test`                 | Vitest service tests (needs `pnpm db:start`)     |
| `pnpm test:e2e`             | Playwright E2E                                   |
| `pnpm db:generate`          | Generate a Drizzle migration from schema changes |
| `pnpm db:custom <name>`     | Generate an empty custom migration               |
| `pnpm db:migrate`           | Apply migrations                                 |
| `pnpm db:stop`              | Stop the local Supabase stack                    |

## Project layout

| Path               | Contents                                                         |
| ------------------ | ---------------------------------------------------------------- |
| `app/`             | Routes, UI, server actions, `/api/webhooks/clerk`, `/api/cron/*` |
| `server/services/` | All business rules; the only code that imports `server/db`       |
| `server/db/`       | Drizzle schema, migrations, client                               |
| `server/storage/`  | Supabase Storage wrapper                                         |
| `server/realtime/` | Supabase Realtime wrapper                                        |
| `lib/validation/`  | Zod schemas shared by forms and services                         |
| `components/ui/`   | shadcn/ui components                                             |
| `tests/`, `e2e/`   | Vitest service tests and Playwright specs                        |

The browser never queries Postgres directly; all data access is server-side through services.

## Documentation

Architecture and technical documentation live in [`docs/claude/`](docs/claude/). Start with
[`architecture.md`](docs/claude/architecture.md), then:

- [`listings.md`](docs/claude/listings.md), [`search.md`](docs/claude/search.md),
  [`messaging.md`](docs/claude/messaging.md), [`moderation.md`](docs/claude/moderation.md),
  [`admin.md`](docs/claude/admin.md), [`site-pages.md`](docs/claude/site-pages.md)
- [`database.md`](docs/claude/database.md), [`services.md`](docs/claude/services.md),
  [`auth.md`](docs/claude/auth.md), [`storage.md`](docs/claude/storage.md)
- [`environment.md`](docs/claude/environment.md) (variables, CI, secrets),
  [`testing.md`](docs/claude/testing.md),
  [`launch-checklist.md`](docs/claude/launch-checklist.md)

Design specs and implementation plans are local-only planning artifacts (`docs/superpowers/`,
`.superpowers/`, `tasks/`, `SPEC.md`, `plan.md`, `todo.md`). They are gitignored and never pushed.

## Deployment

Vercel's Git integration deploys a preview per pull request and production from `main`. GitHub
Actions run lint, format check, typecheck, service tests, build, and E2E on every PR, and apply
database migrations to staging (PRs) and production (merges to `main`). Migrations must stay
backward-compatible with the previous deploy: expand first, contract in a later PR.

## License

Source available for portfolio review. All rights reserved; see [LICENSE](LICENSE).
