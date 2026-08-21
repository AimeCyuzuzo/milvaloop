# Code Quality

Engineering standards for this repo. See [`MAIN.md`](./MAIN.md) for product
overview, layout, and workflow; see [`DESIGN.md`](./DESIGN.md) for UI/UX and
component standards. Where this file and the actual code disagree, that is a
bug in one of them — fix the drift, don't just work around it.

## Operate at senior/CTO level. This is not optional.

- Every change must meet production standards: correct under concurrency,
  tenant-safe (see `MAIN.md`'s multi-tenancy section), secure, and
  maintainable by the next engineer without needing this conversation
  explained to them.
- Clean architecture, no shortcuts, no bloat. If a fix is possible by editing
  an existing function, **edit it — do not write a parallel copy**. A new
  abstraction (helper, wrapper, base class, generic utility) needs a second
  real consumer before it's justified; one caller is not a pattern.
- **Leave the codebase smaller and cleaner than you found it.** Remove
  duplicates, dead code, and unused exports you encounter while touching a
  file, even if they predate your change. Never leave stubs, placeholder
  screens, `TODO`-marked half-features, or hardcoded demo data in a surface
  that ships — either finish it or don't add it.
- "Being small right now" (see `MAIN.md`: this is currently a family/friends
  tool) is a scope decision, not a quality one. A small feature set built
  correctly beats a large one built carelessly.

## Architecture

- **`apiFetch` is the only way `apps/web` talks to `services/main`.** Never
  call raw `fetch` for an API call. It is the single place responsible for
  cross-cutting request behavior (auth headers, 401 → refresh → retry,
  error shape) — add new cross-cutting concerns there, never duplicated at
  call sites. (`apps/web/lib/api/api-fetch.ts`)
- Every write that touches more than one table in a single logical operation
  (e.g. signup creating a user + a tenant + a membership) runs inside a
  database transaction. Partial writes on failure are a correctness bug, not
  an edge case.
- Anything that can race — a unique slug check, a one-time token being
  consumed, a refresh token being rotated — must be safe under concurrent
  requests. Prefer a database constraint (unique index) plus handling the
  conflict, over a check-then-write pattern that has a gap between the check
  and the write.
- Validate at every trust boundary with Zod (matching the existing
  `packages/config` pattern) — request bodies, path/query params that get
  used in a query, env vars. Don't trust a value just because TypeScript's
  compile-time type says it's fine; TypeScript types don't survive the wire.

## TypeScript

- No `any`. If a type is genuinely unknown at a boundary (e.g. an external
  API response), validate it with Zod and let inference give you the real
  type — don't cast past the problem.
- App Router only for `apps/web` — no Pages Router.
- State: **TanStack Query for all server state** (already in use —
  `apps/web/lib/api/query-client.ts`); **Zustand for client-only global
  state** (auth/session, active tenant, UI state that needs to be shared
  across components that aren't in a direct parent/child relationship).
  React Context is for narrow, localized dependency injection only (e.g.
  theme) — not for anything that changes often or is read widely, where its
  re-render behavior becomes a real cost.

## Security

- Passwords are hashed (bcrypt or argon2), never stored or logged in plain
  text, and never included in any API response, ever — not even to the user
  who owns them.
- Sessions/refresh tokens are stored server-side as a hash of the token, never
  the raw value (mirrors how passwords are handled).
- Least privilege: a member's `permissions` array (see the auth/tenancy
  design) determines exactly what they can do. The enforcement mechanism is
  `PermissionsGuard` + `@RequirePermissions(...)` (`services/main/src/auth/`)
  — every protected route uses it; never rely on the frontend hiding a
  button as the actual control.
- Authentication endpoints (login, magic-link request, signup) are
  rate-limited per route via `@nestjs/throttler` (see `AuthController`) —
  keep this in place, and give any new auth-adjacent endpoint the same
  treatment rather than relying on the global default limit alone.
- Never leak whether an email/account exists through response differences
  (e.g. "magic link requested" always returns success, whether or not that
  email has an account).

## Testing

- **Runner by package type.** `services/main` (NestJS) uses Jest — Nest's
  dependency injection relies on TypeScript's `emitDecoratorMetadata`, which
  only a real TS compiler produces, so Jest there always runs through
  ts-jest, never Babel-only. Plain TypeScript packages (`packages/*`) use
  Vitest — zero-config ESM/TS support, no reason to fight ts-jest's
  NodeNext-vs-CommonJS quirks for code with no decorators to preserve.
- **Unit tests** are colocated `*.spec.ts` files next to the code they test.
  Cover pure logic (Zod schemas, token/hash helpers, guards, pipes) here —
  fast, no infrastructure required.
- **Integration tests** for anything that touches the database live in
  `services/main/test/*.e2e-spec.ts` and run against a real Postgres via
  `@milvaloop/db/testing`'s `createTestDatabase()` (a fresh, uniquely-named
  database per test file, migrated for real, dropped on teardown) —
  **never mock the query builder.** A mocked `db.select().where(...)` chain
  cannot catch a wrong constraint name, a bad migration, or a real SQL error
  — exactly the class of bug this module's tests were built to catch. Use
  `resetDatabase()` between test cases within a file. Requires
  `pnpm docker:dev` running locally.
- **Rate-limited routes** get their own dedicated e2e file (see
  `auth-rate-limit.e2e-spec.ts`) rather than being mixed into the main
  functional suite — `ThrottlerModule` would otherwise throttle the many
  fast requests other tests make against the same routes.
- `pnpm test` / `pnpm test:e2e` at the repo root run every package's suite
  via Turborepo; both must pass for every package touched (see MAIN.md's
  verification rule) before a change is done.

## Self-hosted stack

MinIO, not S3. Self-hosted Postgres/Redis, not a managed cloud DB (a managed
Postgres is fine operationally later, but don't couple code to a
vendor-specific feature). SMTP via a real mail server in production; Mailpit
only in dev — never wire a paid transactional-email SaaS into `packages/email`
by default. `apps/web`'s current Vercel deployment is a temporary SEO staging
choice (see `MAIN.md`) — don't add anything to the codebase that only works on
Vercel (no `@vercel/*` packages, no Vercel-specific env var reliance, no ISR
patterns that assume Vercel's edge network). `docs/DEPLOYMENT.md` has the
target self-hosted topology.

## Observability

Not fully built yet — flagged here so it lands as features are built, not
retrofitted later:
- Structured logs (not `console.log`) for anything touching money, auth, or a
  tenant-scoped mutation, including at minimum: actor id, tenant id, action,
  entity, and outcome.
- The audit-event log (see the auth/domain design docs) is the product's own
  observability requirement, not just an engineering one — it's a core
  feature (see `docs/PLATFORM_BRAINSTORMING.md`'s explainability thesis), so
  it isn't optional infrastructure to skip for expedience.
- Error tracking and uptime monitoring are required before any real customer
  is onboarded (not before family/friends testing) — tracked as a
  pre-launch item, see `docs/DEPLOYMENT.md`.
