# Backlog

Deferred work: things deliberately postponed during a change rather than
skipped without a record. Not a place to dump ideas — an item goes here only
when it came up as a real, scoped decision during actual work and was
consciously pushed to later. Remove an item once it's done or once it's
decided it won't be done.

## Redis-backed rate-limiter storage

`@nestjs/throttler`'s default in-memory storage is used today. That's a
deliberate, documented choice for the current single-instance deployment
(see `docs/DEPLOYMENT.md`) — in-memory limits reset per-process and don't
share state across instances. `docs/PROJECT_SETUP_GUIDE.md`'s default
recommendation is Redis-backed storage (`@nest-lab/throttler-storage-redis`
or similar) for when the deployment moves to more than one `services/main`
instance. Revisit before horizontally scaling `services/main`.

## `drizzle-zod` adoption

`packages/types`' Zod schemas currently hand-copy constraints that already
exist on the Drizzle schema (string lengths, nullability, etc.) — e.g.
`cooperativeNameSchema`'s `.max(255)` matches `tenants.name`'s column
definition, but nothing enforces they stay in sync if one changes.
`drizzle-zod` can derive a base Zod schema directly from a Drizzle table,
removing that duplication. Not adopted yet because the current schemas are
small and the drift risk is low; worth it once `packages/db`'s schema grows
enough that keeping the two in sync by hand becomes error-prone.

## e2e test suite flakiness under Jest's default parallel workers

`pnpm test:e2e` runs every `*.e2e-spec.ts` file as its own Jest worker in
parallel, each spinning up a full NestJS app and its own Postgres
connection pool against `createTestDatabase()`. With seven spec files (as
of the audit-events addition), this intermittently produces spurious
failures unrelated to the code under test — `socket hang up`, and
requests that unexpectedly get a 403 instead of a 201 — that don't
reproduce when the same suite is run serially (`jest --runInBand`), which
passes cleanly and deterministically every time. This points to
connection-pool/resource contention across the concurrent workers, not a
real regression. Revisit if it gets worse as more e2e spec files are
added — either cap Jest's worker count for this project, or pool
connections more conservatively per test file.

## Per-page `<title>`s for auth/app pages

`app/auth/layout.tsx` and `app/(app)/layout.tsx` each set one shared
`metadata.title` for every page under them, so individual pages (login vs.
signup vs. forgot-password; dashboard vs. account) can't have their own
`<title>` without duplicating the whole layout. Splitting each of these into
a server component (metadata) + client component (interactivity) pair would
let each page set its own title via Next's metadata API. Deferred because
it's a pure polish item with no functional impact — revisit when the app has
enough distinct pages that generic titles start being confusing in the
browser tab/history.
