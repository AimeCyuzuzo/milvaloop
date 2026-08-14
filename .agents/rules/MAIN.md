---
trigger: always_on
---

# MilvaLoop — Development Rules

This file is the canonical agent guidance for this repo. It covers repo layout,
workflow, and the invariants that apply everywhere. Code-level engineering
standards live in [`CODE_QUALITY.md`](./CODE_QUALITY.md); UI/UX and component
standards live in [`DESIGN.md`](./DESIGN.md). Read the matching file before
substantial work in that area, in addition to this one.

## What MilvaLoop is

MilvaLoop is a multi-tenant cooperative management platform: a shared
operational system of record for a cooperative or informal savings/lending
group — members, monthly share contributions, obligations, share ownership,
and (later) loans and governance — replacing spreadsheets, paper registers, and
WhatsApp threads. The core product differentiator is **explainability**: every
number the system shows must be reconstructable from the events that produced
it, not just displayed as a mutable current value. See
[`docs/PLATFORM_BRAINSTORMING.md`](../../docs/PLATFORM_BRAINSTORMING.md) for
the full product exploration, the Rwandan legal context, and market analysis —
read it before designing anything in the contribution/share/obligation domain.

**Current stage:** an informal tool for the author's family and friends, used
to validate the product before it is offered to real cooperative customers.
This means: no legal-compliance machinery yet, no loans yet, no governance/
voting yet — deliberately smaller than the full concept. It does **not** mean
lower engineering standards; see `CODE_QUALITY.md`.

`docs/DEPLOYMENT.md` describes the intended production architecture.

## Monorepo layout

- `apps/web` — Next.js frontend (public marketing site + the authenticated
  product).
- `services/main` — NestJS backend. Named `main`, not `api`, because we are
  starting as a modular monolith but may split into microservices later;
  `services/` (not `apps/`) is reserved for backend services.
- `packages/ui` — shared shadcn-based component library.
- `packages/email` — email templates/sending.
- `packages/config` — shared runtime/env config (Zod-validated).
- `packages/types` — shared TypeScript types/contracts between web and main.
- `packages/storage` — MinIO (S3-compatible) storage client/helpers.
- `packages/db` — database schema (Drizzle), client, migrations.

## Multi-tenancy — non-negotiable

- The platform is multi-tenant from day one. Every tenant-scoped table
  carries a `tenant_id`, and every query path must be scoped by it. Tenant
  isolation is an architectural invariant, not an afterthought — never add it
  "later."
- **Every database query that fetches a specific object or list of objects
  must filter by `tenant_id`, with exactly one exception**: platform-level
  admin analytics that return aggregate/anonymized numbers across tenants
  (e.g. "total cooperatives on the platform," "total contributions processed
  this month"). Even then, such a query must be structurally incapable of
  returning any individual member's data, name, contact info, or
  tenant-identifying detail — it must aggregate, not filter-and-list. If a
  query needs to join across tenants to produce a single count or sum, that
  is acceptable; if it can return a row that belongs to an identifiable
  member or tenant, it is not an analytics query and must be tenant-scoped
  like everything else.
- The tenant id used to scope a query must always come from the verified
  access token's claims, never from a client-supplied parameter (path, query
  string, or body). A request cannot ask to see another tenant's data by
  changing an id in the URL.

## Reserved slugs

Cooperative (tenant) slugs are user-chosen but must never collide with a
system route, subdomain, or a name that could be confused for an official
MilvaLoop/MilvaLabs surface. Reject at signup, case-insensitively: `www`,
`api`, `app`, `admin`, `auth`, `login`, `logout`, `signup`, `signin`,
`register`, `dashboard`, `settings`, `account`, `billing`, `help`, `support`,
`status`, `docs`, `blog`, `about`, `pricing`, `contact`, `terms`, `privacy`,
`legal`, `mail`, `email`, `ftp`, `assets`, `static`, `public`, `milvaloop`,
`milvalabs`, `null`, `undefined`, `test`. Keep this list in one place in code
(`packages/types`) so it is validated identically wherever a slug is accepted.

## Terminology

- Do not use non-standard, invented, or ambiguous terms — in code
  (identifiers, file names, comments), commit messages, docs, or any other
  written output. Use plain, standard, widely-understood words. For example,
  prefer "Initialize"/"Set up"/"Add" over "Scaffold" in commit messages. When
  in doubt, pick the more common/conventional word.

## Commands

Package manager is **pnpm 9** (never npm/yarn), Node 22+, Turborepo. Run from
the repo root.

```bash
pnpm install                    # install the workspace
pnpm docker:dev                 # start Postgres, Redis, MinIO, Mailpit
pnpm docker:down                # stop them
pnpm dev                        # run every app/service in dev mode
pnpm build                      # build every app/service
pnpm check-types                # typecheck the whole workspace
pnpm lint                       # lint the whole workspace
```

`pnpm dev` and `pnpm build` load the repo-root `.env` (via `dotenv-cli`) before
running Turborepo — see `.env.example` for the full variable list. Copy it to
`.env` and fill in real values before running anything.

## Infrastructure

- Everything runs in Docker containers for local dev: Postgres, Redis, MinIO,
  Mailpit (dev email capture — no real email provider until later). See
  `docker-compose.yml`.
- The target architecture is **self-hosted**: MinIO (not S3), self-hosted
  Postgres/Redis, SMTP via a real mail server later (Mailpit only for dev, not
  a managed provider like SendGrid). `apps/web` is temporarily deployed on
  Vercel purely to warm up SEO while the product is built out — that is a
  staging convenience, not an architectural decision, and there is no
  Vercel-specific configuration anywhere in the codebase to preserve. See
  `docs/DEPLOYMENT.md` for the intended production topology.

## Git conventions

- **Conventional Commits**: `feat|fix|chore|refactor|test|docs(scope): ...`.
  Scopes in current use: `auth`, `db`, `ui`, `web`, `main`, `config`, `email`,
  `storage`, `types`, `infra`, `docs`, `deploy`. Add a new scope only when an
  existing one genuinely doesn't fit.
- Commit messages are plain, professional prose: no AI-filler phrasing, no em
  dashes as a crutch, and **no `Co-Authored-By: Claude` (or any AI) trailer**
  — this has been asked for explicitly and applies to every commit in this
  repo.
- Work on feature branches for anything non-trivial; don't commit straight to
  `main` without a reason to.
- Never commit `.env` (only `.env.example`). Check `git status` before a broad
  `git add` — this repo handles member financial data.

## Verification before claiming completion

Before saying a change is done: typecheck, lint, and the relevant build(s)
must pass for every package touched, **plus a real end-to-end check of the
flow you changed** — not just "it compiles." Concretely:
- Auth/email flows: exercise the actual path against Mailpit
  (`http://localhost:8025`) — request the email, click/use the real link, confirm
  the redirect and resulting session, not just that an endpoint returns 200.
- Storage flows: an actual upload/display round-trip against MinIO, not a
  mocked response.
- UI changes: open the page in the browser (mobile width too — most real
  usage here is on a phone) and interact with it; don't infer correctness
  from the code alone.

## Onboarding

The repo must stay onboarding-ready: someone following `docs/DEPLOYMENT.md`
and the root `README.md` should get a working local stack. If a change alters
setup, ports, env vars, or seed data, update those docs in the same change —
not as a follow-up.
