# Milvaloop — Development Rules

## Monorepo layout

- `apps/web` — Next.js frontend.
- `services/main` — NestJS backend. Named `main`, not `api`, because we are
  starting as a modular monolith but may split into microservices later;
  `services/` (not `apps/`) is reserved for backend services.
- `packages/ui` — shared shadcn-based component library.
- `packages/email` — email templates/sending.
- `packages/config` — shared runtime/env config.
- `packages/types` — shared TypeScript types/contracts between web and main.
- `packages/storage` — MinIO (S3-compatible) storage client/helpers.
- `packages/db` — database schema, client, migrations.

## Multi-tenancy

- The platform is multi-tenant from day one. Every tenant-scoped table
  carries a `tenant_id`, and every query path must be scoped by it.
  Tenant isolation is an architectural invariant, not an afterthought —
  never add it "later."

## Terminology

- Do not use non-standard, invented, or ambiguous terms — in code
  (identifiers, file names, comments), commit messages, docs, or any
  other written output. Use plain, standard, widely-understood words.
  For example, prefer "Initialize"/"Set up"/"Add" over "Scaffold" in
  commit messages. When in doubt, pick the more common/conventional word.

## Infrastructure

- Everything runs in Docker containers for local dev: Postgres, MinIO,
  Mailpit (dev email capture — no real email provider until later).

## Frontend rules (apps/web)

- Next.js.
- Tailwind CSS for styling.
- lucide-react for icons.
- shadcn/ui components only. **Never write a custom className on an
  imported shadcn component.** If a visual variant is needed, add/extend
  a proper `variant` in the component's own variants definition (cva),
  not an ad-hoc className override. This keeps design consistent across
  the app.
- All frontend HTTP calls go through a shared `apiFetch` wrapper (never
  raw `fetch` for API calls). `apiFetch` wraps the native `fetch` and is
  the single place responsible for cross-cutting request behavior —
  starting with: detecting unauthorized (401) responses and attempting a
  token refresh + retry. Other cross-cutting concerns (error handling,
  headers, tenant context, etc.) should be added here too, not
  duplicated at call sites.

## Backend rules (services/main)

- NestJS.

## General

- Docker Compose for local orchestration of Postgres, MinIO, Mailpit (and
  any other local infra).
