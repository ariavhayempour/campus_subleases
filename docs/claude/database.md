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

## Conventions

UUID primary keys (except `users.id` = Clerk user ID); `created_at timestamptz default now()` on
every table; money in integer cents; availability as `date`; locations as geography points.
