# Environments and configuration

| Env        | Supabase              | Clerk                | Vercel          |
| ---------- | --------------------- | -------------------- | --------------- |
| Local      | Supabase CLI (Docker) | Development instance | `pnpm dev`      |
| Staging    | Separate project      | Development instance | Preview deploys |
| Production | Separate project      | Production instance  | Production      |

All services run on free tiers for the trial (Vercel Hobby, Supabase Free ×2, Clerk, Mapbox,
Sentry). Supabase Free pauses idle projects after 7 days (unpause staging in the dashboard) and
has no automatic backups — `pg_dump` production before any risky migration.

## Environment variables

`.env.example` lists every variable (names only). Local values go in `.env.local` (gitignored).
Vercel holds staging (Preview) and production values. Adding a variable needs owner approval.

| Variable                                                           | Scope                 | Used by                                                   |
| ------------------------------------------------------------------ | --------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`            | public / secret       | Clerk                                                     |
| `CLERK_WEBHOOK_SIGNING_SECRET`                                     | secret                | `/api/webhooks/clerk`                                     |
| `DATABASE_URL`                                                     | secret                | Runtime (transaction pooler)                              |
| `DATABASE_DIRECT_URL`                                              | secret                | `pnpm db:migrate`                                         |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public                | Browser Realtime (later)                                  |
| `SUPABASE_SECRET_KEY`                                              | secret                | Storage + Realtime broadcast (later)                      |
| `NEXT_PUBLIC_MAPBOX_TOKEN`                                         | public                | Maps (later; URL-restricted token)                        |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`                      | public / build secret | Sentry                                                    |
| `CRON_SECRET`                                                      | secret                | `/api/cron/*` (later)                                     |
| `NEXT_PUBLIC_SITE_URL`                                             | public                | Absolute URLs (later)                                     |
| `E2E_CLERK_USER_EMAIL`                                             | test only             | Playwright (a `+clerk_test` user; signs in by email code) |

## CI (GitHub Actions)

- `ci.yml` on every PR and on `main`: lint, format check, typecheck, service tests, build, E2E —
  against a Supabase CLI Postgres started in the runner.
- `migrate.yml`: PRs touching `server/db/migrations/**` apply migrations to **staging**;
  merges to `main` apply them to **production** (GitHub `production` environment).
- Vercel's Git integration deploys previews and production independently, so a deploy can start
  before its migration finishes. Expand-then-contract migrations keep that window harmless.
- Secrets are listed below.

## GitHub secrets

Repository secrets (Settings → Secrets and variables → Actions):

| Name                                | Value                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_<dev-instance>` (Clerk dev instance → API keys)                        |
| `CLERK_SECRET_KEY`                  | `sk_test_<dev-instance>` (Clerk dev instance → API keys)                        |
| `E2E_CLERK_USER_EMAIL`              | `<name>+clerk_test@example.com` (an existing dev-instance user)                 |
| `STAGING_DATABASE_DIRECT_URL`       | `postgresql://postgres.<staging-ref>:<db-password>@<pooler-host>:5432/postgres` |

Environment secret (Settings → Environments → `production`; the name must match `migrate.yml`):

| Name                             | Value                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `PRODUCTION_DATABASE_DIRECT_URL` | `postgresql://postgres.<production-ref>:<db-password>@<pooler-host>:5432/postgres` |

Database URLs: Supabase dashboard → Connect → **Session pooler** (port 5432). Not the direct
connection (`db.<ref>.supabase.co` is IPv6-only and GitHub runners have no IPv6), and not the
transaction pooler (port 6543 breaks migrations; it is for runtime `DATABASE_URL`). A lost
database password is reset in Project Settings → Database.
