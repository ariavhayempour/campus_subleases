# Architecture

Student sublease platform: Next.js (App Router) on Vercel; Supabase Postgres + PostGIS (via
Drizzle), Supabase Storage and Realtime; Clerk auth; Mapbox; Sentry. Design spec:
`docs/superpowers/specs/2026-09-24-sublease-platform-design.md` (untracked planning artifact).

## Layers

```
app/                 routes, UI, server actions, /api/webhooks/clerk, /api/cron/cleanup
                     (daily storage sweep, see storage.md)
  admin/             admin pages (listings, reports, users, conversations, stats, audit);
                     desktop-only
  _components/       shared app components (site header, MessagingProvider: the one Realtime
                     subscription and unread count, mounted in the root layout)
  _lib/              app glue: action results, guards, the
                     browser Realtime subscription (realtime-client.ts)
server/auth/         Clerk session → Actor (calls services only)
server/clerk/        Clerk Backend API wrapper (users.ts); only services call it
server/services/     all business rules; the only importers of server/db
server/db/           Drizzle schema, migrations, client
server/storage/      Supabase Storage wrapper
server/realtime/     Supabase Realtime wrapper (server-side broadcast)
lib/validation/      Zod schemas shared by forms and services
lib/                 framework-free helpers and constants (APP_NAME, reserved slugs, env)
components/ui/       shadcn/ui components (generated; edit freely)
```

## Rules

- `app/` calls services; never `server/db`.
- The browser never queries Postgres; RLS denies all direct access.
- Services are `(actor, input) → result`: validate, check permissions, throw typed errors
  (see `services.md`).
- UI is desktop-first and responsive; admin pages are desktop-only.
- Dependencies are limited to the approved list in the design spec.

See also: `listings.md`, `search.md`, `messaging.md`, `storage.md`, `database.md`, `services.md`,
`auth.md`, `testing.md`, `environment.md`, `site-pages.md`, `moderation.md`, `admin.md`.
