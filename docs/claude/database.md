# Database

## Access rules

- Only `server/services/*` import `server/db`. The browser never talks to Postgres.
- Services call `db()`, never a module-level client. `db()` returns the transaction bound by
  `withDbScope()` (tests bind a rolled-back transaction per test) or the root client.
- Nested `db().transaction(...)` calls become savepoints, so services can compose.
- Runtime uses `DATABASE_URL` (Supabase transaction pooler; `prepare: false`). Migrations use
  `DATABASE_DIRECT_URL`. Locally both are `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

## Row-level security

Every table in `public` has RLS enabled and **no policies**, so Supabase's auto-generated API and
the `anon`/`authenticated` roles can read nothing. The server connects as `postgres`, which
bypasses RLS. `tests/db/harness.test.ts` enforces both facts for every table. New tables must call
`.enableRLS()` (the installed drizzle-orm has no `pgTable.withRLS` helper).

### Realtime policy

`realtime.messages` (Supabase's table behind Realtime) has exactly one policy, "users join their
own channel": `for select to authenticated using (realtime.topic() = 'user:' || (select
auth.jwt() ->> 'sub'))`. It was added by the custom migration `0006_realtime-user-channel-policy.sql`.
`tests/db/realtime-policy.test.ts` pins it (exactly one policy on `realtime.messages`, command `SELECT`, role `authenticated`, and a
`USING` expression containing the `'user:'` literal and `sub`), so a second policy fails the test. See `messaging.md`.

## PostGIS

PostGIS lives in the `extensions` schema (Supabase convention; on the default search_path).
`geographyPoint` maps `geography(Point, 4326)` to `{ lng, lat }`: writes go through
`ST_MakePoint`, reads parse the hex EWKB Postgres returns (`server/db/geography.ts`).

## Migrations

- Edit `server/db/schema/*`, then `pnpm db:generate --name <change>`. Review the SQL.
- Extensions, seed data, and anything drizzle-kit cannot express: `pnpm db:custom <name>` and
  write the SQL by hand.
- Apply locally with `pnpm db:migrate` (tests also apply migrations in Vitest global setup).
- Never edit a migration that has been applied anywhere (staging applies PR migrations).
- Migrations must work with the previous deploy's code: expand first (add nullable columns,
  new tables), contract in a later PR.
- drizzle-kit quotes custom column types (e.g. emits `"geography(Point, 4326)"` as a quoted
  identifier) in generated SQL; hand-fix the migration file to remove the quotes before applying.
- Deploys: `.github/workflows/migrate.yml` applies migrations to staging when a PR touches
  `server/db/migrations/**`, and to production on merge to `main`. Vercel deploys independently,
  so new code can briefly run against the old schema (and vice versa); expand-then-contract keeps
  that safe. See `environment.md`.

## Moderation tables and indexes

`reports` and `admin_audit_log` (RLS enabled, no policies) back `moderation.md` and `admin.md`.
Migration `0007_moderation-indexes.sql` added two indexes:
`admin_audit_log_target` (`target_type`, `target_id`, `created_at`) for per-target history, and
`reports_reporter` (`reporter_id`, `created_at`) for the 24-hour report rate limit. Reports have a
partial unique index `reports_open_unique` (reporter, target type, target id, where open) for
duplicates. Report and audit `target_id` is text, so joins to uuid ids compare as text. Their user
references are `ON DELETE SET NULL`, so deleting an account keeps the rows.

## Conventions

UUID primary keys (except `users.id` = Clerk user ID); `created_at timestamptz default now()` on
every table; money in integer cents; availability as `date`; locations as geography points.

## Seed data

Launch schools are inserted by a custom migration (`*_seed-schools.sql`, `ON CONFLICT DO NOTHING`),
so every environment gets them. Adding a school = a new custom migration with one `INSERT`. School
slugs share the top-level URL space and must not appear in `lib/reserved-slugs.ts`
(`tests/services/schools.test.ts` checks every stored slug).

## Users

`users` mirrors Clerk by user ID. Accounts are email + password with first and last name; there
are no usernames, and email lives only in Clerk. `first_name`/`last_name` are nullable (Clerk
allows users without names, e.g. created from the dashboard). `display_name` is never edited
directly: `syncUserFromClerk` and `ensureUser` derive it with `formatDisplayName`
(`lib/display-name.ts`) as "First L." so the full last name is never shown to other users.
