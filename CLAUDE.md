# Student Sublease Platform (Next.js + Vercel Web App)

## Tech Stack

- Language: TypeScript (strict mode)
- Framework: Next.js (App Router), deployed on Vercel (incl. Vercel Cron)
- Runtime: Node 22+
- Package manager: pnpm
- Auth: Clerk (username or email + password)
- Database: Supabase Postgres + PostGIS, accessed only via Drizzle ORM (drizzle-kit migrations)
- Storage / live chat: Supabase Storage, Supabase Realtime Broadcast (private channels)
- Maps / geocoding: Mapbox (react-map-gl, mapbox-gl, @mapbox/search-js-react)
- UI: Tailwind CSS + shadcn/ui; images processed with sharp
- Validation: Zod; error monitoring: Sentry
- Tests: Vitest (services, against real local Postgres), Playwright (E2E)
- CI: GitHub Actions (lint, typecheck, service tests, E2E); Vercel preview deploy per PR
- Key dirs: `app/`, `server/services/`, `server/db/`, `server/storage/`,
  `server/realtime/`, `lib/validation/`

## Purpose

- Website where college students sublease their own apartment, house, or room to
  other students (students only; no landlords). Free, website only, desktop-first
  and responsive (usable down to phone width; admin is desktop-only)
- Launches with UW–Madison, University of Michigan, and UCLA; new schools are data,
  not code
- Product name not chosen: all user-facing copy reads it from the `APP_NAME` constant
- Design spec: `docs/superpowers/specs/2026-09-24-sublease-platform-design.md`

## Architecture Rules

- `app/` holds routes, UI, server actions, `/api/webhooks/clerk`, `/api/cron/*`; it
  calls services only
- `server/services/*` own all business rules: plain functions `(actor, input) → result`
  that validate, check permissions, and throw typed errors. Only services import
  `server/db`
- The browser never queries Postgres through Supabase's auto-generated API; all data
  access is server-side through Drizzle
- Storage and Realtime sit behind thin wrappers (`server/storage`, `server/realtime`)
- Zod schemas in `lib/validation/` are shared by forms and services
- Migrations are committed and must be backward-compatible with the previous deploy
  (expand, then contract in a later PR)

## Development Workflow

First time: `pnpm install`, then start local Supabase (Supabase CLI, Docker).

```bash
# Build/Run
pnpm dev              # Dev server (http://localhost:3000)
pnpm build            # next build (the gate: must exit 0, zero TS errors)
pnpm start            # Serve the production build locally

# Test (run before PR)
pnpm test             # Vitest service tests (needs local Supabase Postgres)
pnpm test:e2e         # Playwright E2E

# Quality
pnpm lint             # Lint
pnpm typecheck        # tsc --noEmit
```

## Code Style

- TypeScript strict mode, no `any` in committed code; explicit types on public boundaries
- 2-space indent, single quotes, trailing commas
- kebab-case filenames, one component/route per file (Next.js reserved names like
  `page.tsx`, `layout.tsx`, `route.ts` excepted)
- Route handlers return `Response` objects with explicit status + content-type
- Comments: default to one concise line for a non-obvious why; push anything longer
  into `docs/claude/` (see rule 2). No multi-paragraph doc-comment essays, no
  restating what the code does, no comment rot
- Ask before adding any dependency beyond the approved list in the design spec (§2), changing the
  package manager, adding a UI component library, adding `vercel.json` overrides,
  or introducing environment variables or secrets

## Documentation

- `docs/claude/` - all project documentation (architecture, decisions, structure)
- `docs/superpowers/` - design specs and plans (planning artifacts, untracked)

## Working Rules

Read and follow all of them.

### 1. Read this file first

Always read this `CLAUDE.md` at the start of every session, and again whenever
context is cleared. Understand the guidelines below and follow them throughout
the session.

### 2. Documentation lives in `docs/claude/`

All project documentation belongs in Markdown files under `docs/claude/`. Keep
code comments to a single concise line — enough to clarify intent, never more.
Push anything longer into the docs.

### 3. Review the docs before acting

Before planning or building anything, review the relevant files in
`docs/claude/` (and the design spec in `docs/superpowers/specs/`) to understand
existing dependencies, decisions, and structure. Let the docs inform the plan.

### 4. Never commit, stage, or push

Do not run `git add`, `git commit`, or `git push` — ever, unless I give explicit
one-time permission for a specific action. When a task is complete, tell me so
and stop; I will commit manually.

### 5. Planning artifacts stay untracked

All planning artifacts — `docs/superpowers/`, the `tasks/` folder, `SPEC.md`,
`plan.md`, `todo.md` — always remain untracked. Never stage or commit them.

### 6. No co-author tags in commits

When you are granted one-time permission to commit under rule 4, never include
co-author trailers (e.g. `Co-Authored-By:`) in the commit message.

### 7. Code comments describe the code, not the plan

Code-file comments must never reference planning-artifact identifiers — story
numbers, task numbers (`T5`), spec section numbers (`§8`), or similar. Those are
mutable and get reorganized; a comment pinned to one reads as stale the moment it
changes. Explain the technical reason instead: functionality, behavior,
constraints, or dependencies. (Cross-references between user-story docs may cite
other story numbers freely — this rule is about code comments only.)

## Common Mistakes

- Run `pnpm build`, `pnpm typecheck`, `pnpm lint`, and `pnpm test` before declaring a task done
- Add code-file comments longer than one line into a respective `docs/claude` file.
