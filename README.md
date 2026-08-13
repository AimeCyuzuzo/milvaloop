# MilvaLoop

A multi-tenant cooperative management platform — a shared operational system
of record for a cooperative or informal savings/lending group. A product of
MilvaLabs.

See [`docs/PLATFORM_BRAINSTORMING.md`](./docs/PLATFORM_BRAINSTORMING.md) for
the product exploration and [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) for
setup and deployment. Development rules live under
[`.agents/rules/`](./.agents/rules/).

## Quick start

```bash
pnpm install
cp .env.example .env   # fill in real values
pnpm docker:dev        # Postgres, Redis, MinIO, Mailpit
pnpm dev
```

- `apps/web` — Next.js frontend, `http://localhost:5330`
- `services/main` — NestJS backend, `http://localhost:5331`
- Mailpit (dev email capture) — `http://localhost:8025`

## Layout

```
apps/web          Next.js frontend
services/main      NestJS backend
packages/ui        Shared shadcn-based component library
packages/types      Shared TypeScript types/contracts
packages/config     Shared runtime/env config (Zod-validated)
packages/db         Database schema (Drizzle), client, migrations
packages/storage    MinIO (S3-compatible) storage client
packages/email      Email templates/sending
docs/               Product and deployment documentation
```

## Commands

```bash
pnpm dev           # run every app/service in dev mode
pnpm build         # build everything
pnpm check-types   # typecheck the whole workspace
pnpm lint          # lint the whole workspace
pnpm docker:dev    # start local infra containers
pnpm docker:down   # stop them
```
