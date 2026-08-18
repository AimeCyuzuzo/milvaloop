# New Project Setup Guide

A stack-opinionated reference for setting up this project — the default
answer to "how do we set this up" for anything not covered elsewhere.
Deviate only with a reason, not by default.

This guide describes a **stance**, not just a tool list: prefer boring,
self-hostable, well-understood technology; validate everything at trust
boundaries; make every write safe under concurrency; keep one source of truth
for config, types, and reusable logic. When something in a new project
genuinely doesn't fit this guide, **stop and ask** rather than inventing a
workaround — a wrong guess compounds silently, a question costs one message.

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Package manager | pnpm (workspaces) | Fast, disk-efficient, strict dependency resolution (no phantom deps). Never mix with npm/yarn in the same repo. |
| Monorepo build | Turborepo | Caching + task graph across apps/packages; works with plain pnpm workspaces, no extra runtime. |
| Frontend | Next.js (App Router only) | Server components, file-based routing, one framework for marketing pages and the authenticated app. No Pages Router in new code. |
| Backend | NestJS | Modular, DI-based, scales from a single service to split microservices later without a rewrite. |
| Database | PostgreSQL | Relational integrity, JSONB when you need flexibility, mature tooling, easy to self-host. |
| ORM | Drizzle | Typed schema is the single source of truth, SQL-like query builder (no hidden magic), first-class migrations. |
| Cache / queue / rate-limit store | Redis | One tool for caching, session/rate-limit counters, and (later) job queues. |
| Object storage | MinIO (S3-compatible) locally and self-hosted; swappable for managed S3 if ever needed | Self-hostable by default, same API as S3 so nothing is thrown away if that changes. |
| Dev email capture | Mailpit | Real SMTP flow in dev without sending real email or depending on a SaaS. |
| Shared UI | shadcn/ui + Tailwind | Owned code (not a black-box npm dependency), consistent design tokens, accessible primitives via Radix. |
| Icons | lucide-react | One icon set, consistently. |
| Server state (frontend) | TanStack Query | Caching, refetching, request dedup — don't hand-roll this in `useEffect`. |
| Client-only global state (frontend) | Zustand | Session/active-tenant/UI state shared across unrelated components. |
| Validation | Zod | One validation library everywhere: env vars, request bodies, path/query params, external API responses. |

Only change a row above for a concrete reason (a real constraint the new
project has that this one didn't) — not preference or novelty. If unsure
whether a substitution is warranted, ask.

## 2. Monorepo layout

```
apps/web            # frontend (public site + authenticated app)
services/<name>      # backend service(s). Name by domain, not "api" —
                      # a modular monolith today may split into more
                      # services later; the name shouldn't imply it's the
                      # only one.
packages/ui          # shared component library (shadcn-based)
packages/config      # shared runtime/env config (Zod-validated)
packages/types       # shared TypeScript types/contracts between frontend and backend
packages/db          # database schema, client, migrations
packages/email       # email templates/sending
packages/storage     # object storage client/helpers
```

Add a package only once something is genuinely shared by two consumers — see
§10 (DRY). Don't pre-create empty packages "for later."

## 3. Environment & configuration

- **One `.env` file at the repo root.** Every app/service reads from it —
  no per-package `.env` files to keep in sync. `dotenv-cli` loads it before
  `dev`/`build` scripts run through Turborepo:
  ```json
  "dev": "dotenv -e ../../.env -- turbo run dev"
  ```
- Commit a `.env.example` with every variable the project uses and a safe
  placeholder value. Never commit the real `.env`.
- All env vars are parsed and validated through a single Zod schema in
  `packages/config` at process start — fail fast on a missing/malformed
  var, don't discover it at first use three requests in.
- If a new env var is genuinely needed, add it to both `.env.example` and the
  config schema in the same change that introduces it.

## 4. Local infrastructure (Docker)

- Postgres, Redis, MinIO, and Mailpit run as Docker containers via
  `docker-compose.yml` — one `pnpm docker:dev` / `pnpm docker:down` pair.
- No local infra dependency should require a native install (no "install
  Postgres via brew" instructions) — the container is the source of truth for
  versions across every contributor's machine.
- Seed data is a script, not manual clicking — a fresh clone plus
  `docker:dev` plus one seed command should produce a usable local dataset.

## 5. Backend architecture

- Modular by domain (Nest modules), not by technical layer — a feature's
  controller, service, and DTOs live together.
- **Validate at every trust boundary** with Zod: request bodies, path/query
  params used in a query, external API responses. A TypeScript type is a
  compile-time-only guarantee; it does not survive the network.
- **Every write touching more than one table in one logical operation runs
  in a database transaction.** A partial write on failure is a correctness
  bug, not an edge case. The test for "one logical operation": if a failure
  partway through would leave the data in a state that's wrong or
  contradictory on its own — not just incomplete — the writes belong in one
  transaction. Concretely:
  - **In the transaction:** writes that must all succeed or all fail
    together to keep the data valid. Signup creating a user + a tenant + a
    membership row (a user with no membership, or a membership pointing at
    no tenant, is a broken state). Deducting a balance and inserting the
    ledger entry that explains it (see §15 — a balance change with no
    corresponding event is a broken invariant, not a missing nice-to-have).
    An audit-log row for the write it describes belongs in the same
    transaction as that write — an audit entry for a change that got rolled
    back is worse than no entry.
  - **Not in the transaction — do after it commits:** anything external to
    the database, because it can't be rolled back and its latency would hold
    a DB connection/lock open for no reason. Sending an email, calling a
    third-party API, enqueuing a background job, pushing a webhook. Trigger
    these only after the transaction has committed, and design them to be
    safely retried (idempotent) — a crash between "transaction committed" and
    "email sent" means the side effect might not fire and must be
    re-triggerable, not that the DB write should have waited for it.
  - **Also not in the transaction:** writes that are genuinely unrelated to
    the operation just because they happen in the same request handler (an
    analytics counter for a different feature, a "last active" timestamp
    update that's fine to lose on a crash). Bundling unrelated writes into
    one transaction only adds lock contention and a bigger blast radius for
    an unrelated failure to roll back something it shouldn't. When unsure
    whether two writes are "the same operation" or "merely nearby," ask: if
    the first succeeded and the second failed, would you want the first one
    undone? If no, they don't belong in the same transaction.
  - Plain reads don't need a transaction unless correctness depends on
    reading a consistent snapshot across more than one query, or the read is
    part of a read-then-write sequence that must not race (see the next
    bullet) — in that case the read happens inside the same transaction as
    the write it guards.
- **Anything that can race** (a unique-slug check, a one-time token being
  consumed, a token rotation) must be safe under concurrent requests. Prefer
  a database constraint (unique index) plus conflict handling over a
  check-then-write pattern that has a gap between the check and the write.
- Structured logs (not `console.log`) for anything touching money, auth, or a
  mutation of persisted state — at minimum: actor id, action, entity,
  outcome. An audit-event log is a product feature when the domain needs
  explainability (financial/record-of-truth systems), not just an
  engineering nicety — build it as a first-class feature when the domain
  calls for it, not bolted on later.

## 6. Database & ORM

- Schema lives in `packages/db`, defined in Drizzle, and is the single
  source of truth — the ORM client, migrations, and generated types all
  derive from it.
- Migrations are generated (`drizzle-kit generate`), never hand-edited SQL
  files that drift from the schema.
- If the project is multi-tenant, every tenant-scoped table carries a
  `tenant_id`, and every query that fetches a specific object or list is
  scoped by it — sourced from the verified auth token's claims, never from a
  client-supplied path/query/body parameter. The only exception is
  aggregate, anonymized cross-tenant analytics that are structurally
  incapable of returning an identifiable row.
- Write a small `testing.ts`-style helper package for spinning up/tearing
  down a test database (or transaction-per-test rollback) — every test that
  touches the DB should run against a real instance, not a mocked query
  builder.

## 7. Caching

- Redis is the cache layer: query-result caching for expensive/slow reads,
  session and rate-limit counters, and (later) a job queue backend — one
  piece of infrastructure, several uses, not a different tool per concern.
- Cache invalidation is explicit and colocated with the write that
  invalidates it — a service method that writes X also clears X's cache key
  in the same method, not in some unrelated place discovered later by
  debugging stale data.
- Default to **no caching** for anything touching money/permissions/auth
  state unless you have a specific, reasoned TTL and invalidation path for
  it. A stale balance or a stale permission is worse than a slow query.

## 8. Real-time & WebSockets

**Default to not using a socket at all.** A persistent, stateful connection
is real operational complexity — reconnect/backoff logic, per-instance
connection affinity, its own scaling story — and most features that feel
like they need "real-time" don't:

- The frontend needs to show fresh data after *its own* mutation → invalidate
  the relevant TanStack Query key in the mutation's `onSuccess`. No socket
  needed.
- The frontend needs to notice a change made by someone else, on a timescale
  of seconds being fine → `refetchInterval` / `refetchOnWindowFocus` on the
  query. No socket needed.
- The server needs to push updates to the client, but only server → client
  → Server-Sent Events (SSE) is enough, and is far cheaper to operate than a
  full-duplex socket (plain HTTP, no separate protocol, trivially
  load-balanced).

**A WebSocket is warranted when the interaction is genuinely bidirectional
and latency-sensitive** — chat/messaging, live presence or cursors,
collaborative editing, or a dashboard with a update frequency high enough
that polling would either lag visibly or spam the backend. If you're
reaching for a socket, be able to name which of these the feature actually
is — "it would be nice to have it feel live" is not by itself the bar.

Where sockets have to live, and how they have to behave:

- The socket gateway is its own thin layer (e.g. a Nest `Gateway`) that
  calls the **same service methods** a REST controller would — business
  logic lives once, in the service layer, not duplicated between an HTTP
  controller and a socket handler.
- **Authenticate at connection time**, not by trusting that a prior HTTP
  login happened — verify the session/token during the socket handshake and
  reject the connection if it's invalid. Because a socket connection can
  outlive the session that opened it, also handle the case where a token is
  revoked or a session ends while the socket is still open (disconnect it,
  don't let it keep receiving events for a session that no longer exists).
- **Every inbound socket message is untrusted input**, exactly like a
  request body — validate it with Zod the same way, and apply authorization
  checks per-message, not just once at connect (a connection being
  authenticated doesn't mean every event it sends is now allowed).
- **Rate-limit socket events** the same way HTTP endpoints are rate-limited
  (§12) — a long-lived connection doesn't exempt its messages from abuse
  limits.
- **Scale through Redis pub/sub**, not in-process broadcast. A socket
  connection is sticky to whichever server instance accepted it; once
  there's more than one instance, an event produced on instance A has to
  reach a client connected to instance B, which requires a shared pub/sub
  layer — this is why real-time sits next to Redis in this guide rather than
  being its own separate piece of infrastructure.
- **Design for disconnection.** Reconnect with backoff on the client, and
  never make a functionally important outcome (e.g. "the user was notified")
  depend solely on socket delivery — persist it and make it queryable over
  the normal REST path too, so a missed socket event is a UX delay, not data
  loss.
- Test socket features with a real client connecting to a real test server
  (`socket.io-client` or `ws` against an ephemeral test instance), not just a
  unit test of the handler function in isolation — connection lifecycle bugs
  (duplicate listeners on reconnect, missed auth on reconnect) are the actual
  risk and only show up with a real connection round-trip.

## 9. Frontend state management

- **TanStack Query for all server state** — anything that originates from
  the backend. Don't `useEffect` + `useState` a fetch by hand.
- **Zustand for client-only global state** — session/auth, active
  tenant/workspace, UI state shared across components that aren't in a
  direct parent/child relationship.
- React Context is for narrow, localized dependency injection only (theme,
  a form's field registry) — never for state that changes often or is read
  widely; its re-render behavior becomes a real cost at that point.
- One fetch wrapper (e.g. `apiFetch`) is the **only** way the frontend talks
  to the backend — never a raw `fetch` at a call site. It owns every
  cross-cutting concern: auth headers, 401 → refresh → retry, and a
  consistent error shape. A new cross-cutting concern (retry policy,
  request id, telemetry) is added there once, not duplicated at call sites.

## 10. DRY — reusable components and functions

Applies to both frontend and backend:

- Extract a shared abstraction (component, hook, service helper, utility)
  **after the second real use site**, not preemptively. One caller is not a
  pattern.
- Any set of items rendered with the same visual shape (cards, rows, list
  items) is built by mapping over a data array — never hand-copied as N
  near-identical JSX blocks with different literals.
- On the backend, repeated query patterns, permission checks, or
  request/response shaping belong in a shared service/util, not copy-pasted
  across controllers.
- When you touch a file and notice a duplicate, dead code, an unused export,
  or a stub left behind — clean it up in the same change, even if it
  predates your work. Leave the codebase smaller than you found it.
- Don't add a new abstraction layer (generic base class, wrapper, plugin
  system) speculatively "in case it's needed later." Build the concrete
  thing twice if you have to; the third time tells you what the real
  abstraction should look like.

## 11. Authentication & authorization

- Passwords: bcrypt or argon2, never logged or returned in any API response
  — including to the user who owns them.
- Sessions/refresh tokens: store a hash of the token server-side, never the
  raw value (same treatment as passwords). The raw token exists only in the
  client's possession and the one request that issued it.
- Authorization is a backend concern, checked on every protected route,
  based on a permissions/role model attached to the verified session —
  never inferred from the frontend hiding a button or a route.
- Never leak whether an account/email exists through response differences
  (a "password reset requested" or "magic link sent" response is identical
  whether or not that address has an account).
- Token rotation, one-time token consumption, and any other
  check-then-act auth flow must be race-safe (see §5 — unique constraint,
  not check-then-write).

## 12. Rate limiting

- Rate-limit every authentication endpoint (login, signup, password/magic-link
  request, token refresh) before it is reachable by non-trusted traffic —
  this is a pre-launch requirement, not an optional hardening pass.
- Back it with Redis (shared counters across instances), not in-process
  memory, so it holds up behind a load balancer.
- Rate-limit by a stable identifier appropriate to the endpoint (IP for
  unauthenticated endpoints, account id for authenticated ones) and return a
  generic, non-revealing error on limit.

## 13. Testing

- **Test everything that isn't trivial glue** — every service method with
  branching logic, every guard/permission check, every validation schema's
  edge cases, every DB-touching function against a real test database (see
  §6).
- Test pyramid: unit tests for pure logic and validation, integration tests
  for anything touching the database or an external boundary, a thin layer
  of end-to-end tests for the critical user flows (signup, login, the
  product's core write path).
- **A change isn't done because it compiles.** Before claiming completion:
  typecheck, lint, and build every touched package, **and** exercise the
  actual flow you changed — an auth/email flow through the real dev SMTP
  capture tool with a real link click, a storage flow through a real
  upload/download round-trip, a UI flow by actually opening and clicking
  through the page (at mobile width first).
- Don't mock away the thing you're trying to prove works — mock external
  third parties, not your own database or business logic.

## 14. Security baseline

- Validate at every trust boundary (§5) — no exceptions for "internal" data.
- Least privilege by default — a new permission/role starts able to do
  nothing until explicitly granted a capability.
- No secrets in source control, ever — `.env` is gitignored, only
  `.env.example` is committed. Check `git status` before a broad `git add`
  in any repo that handles personal or financial data.
- CORS locked to known origins in production; permissive only in local dev.
- Dependencies: keep a lockfile committed, review new dependencies for
  maintenance status before adding them, prefer fewer dependencies over a
  library for something trivial to write directly.

## 15. Observability

Build this in as features ship, not as a retrofit:

- Structured logs for auth, money, and mutation paths (§5).
- Error tracking and uptime monitoring wired in before any non-trusted user
  reaches the system — tracked explicitly as a pre-launch checklist item if
  deferred during early internal-only use.
- An audit/event log when the domain's core value is explainability (e.g.
  financial or record-of-truth systems) — treat it as a core feature to
  design in from the start of that domain, not bolted on after.

## 16. Self-hosted-first

- Default to infrastructure you can self-host: Postgres, Redis, MinIO
  (S3-compatible), a real SMTP server in production. Mailpit and a managed
  deploy target (if used at all) are dev/staging conveniences, never
  something the codebase is architecturally coupled to.
- Don't add a vendor-specific package or config (a specific PaaS's edge
  runtime, a proprietary ISR pattern, a paid transactional-email SaaS as the
  default) unless the project has explicitly decided to commit to that
  vendor.

## 17. Git conventions

- Conventional Commits: `feat|fix|chore|refactor|test|docs(scope): ...`.
  Keep the scope list short and tied to real package/service names in the
  repo; add a new scope only when nothing existing fits.
- Plain, professional commit messages — no filler phrasing, no AI
  attribution trailers unless the project wants them.
- Feature branches for anything non-trivial; don't commit straight to the
  default branch without a reason.
- Use plain, standard, widely-understood terminology in code, commits, and
  docs — avoid invented or ambiguous terms for ordinary concepts.

## 18. CI basics

- Every PR runs: install, typecheck, lint, build, test — for the whole
  workspace, gated on Turborepo's affected-package detection once the repo
  is large enough to need it.
- Migrations are checked in CI (drizzle-kit's check/diff command) so a
  schema/migration drift is caught before merge, not in production.

## 19. Quick-start checklist for a brand-new project

1. Init pnpm workspace + Turborepo, add the packages from §2 that the
   project actually needs yet (not all of them on day one).
2. Add `docker-compose.yml` for Postgres/Redis/MinIO/Mailpit, `.env.example`,
   and the Zod-validated config package.
3. Set up `packages/db` with Drizzle, one migration, one seed script.
4. Set up the backend service with one health-check route validated
   end-to-end (request → logs → response).
5. Set up the frontend app with the shared UI package wired in, one page,
   TanStack Query provider, Zustand store for session.
6. Build auth first: signup, login, session/refresh handling, password
   hashing — with tests and a real end-to-end check against Mailpit if email
   verification is involved.
7. Add rate limiting to the auth endpoints before anything is exposed
   outside a trusted local group.
8. Wire CI (typecheck/lint/build/test) before the second contributor joins.
9. Write the project's own version of this guide's deviations, if any, at
   the top of its `docs/README.md` — what differs from this default and why.

## 20. When something doesn't fit

If a new project has a requirement this guide doesn't cover, or a constraint
that seems to conflict with a rule here (a real-time requirement that makes
Redis-only caching insufficient, a compliance need that changes the auth
model, a domain that doesn't fit the monorepo layout) — **ask before
inventing a workaround**. State the specific conflict and the options
considered; don't silently pick one and proceed as if it were obviously
correct.
