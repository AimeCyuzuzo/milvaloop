# Deployment

How MilvaLoop is deployed today, and the target architecture it's built
toward. This is a living document — update it in the same change whenever
setup, ports, env vars, or the deployment topology itself changes (see
`.agents/rules/MAIN.md`'s onboarding rule).

## Principles

- **Self-hosted by default.** MinIO instead of S3, self-hosted Postgres and
  Redis, SMTP through a real mail server instead of a managed transactional
  email SaaS. This is a deliberate architectural choice (see
  `.agents/rules/CODE_QUALITY.md`), not just a cost preference — it also
  matters for the Rwandan market this product targets: Rwanda's data
  protection law requires personal data to be stored in Rwanda by default,
  or under an explicit offshore-storage certificate (see
  `docs/PLATFORM_BRAINSTORMING.md` §3.9). Self-hosting keeps that option open
  instead of being structurally dependent on a foreign platform.
- **`apps/web`'s current Vercel deployment is a temporary exception**, kept
  only to get the marketing site indexed by search engines while the product
  is being built. It is not architectural: nothing in the codebase is
  Vercel-specific (no `vercel.json`, no `@vercel/*` packages, no edge-network
  assumptions), so moving it to self-hosted infrastructure later is a hosting
  change, not a code change. It should move before any real cooperative's
  data is involved.
- **Migrations run before the app that depends on them restarts.** Never
  deploy application code that expects a schema change the database doesn't
  have yet.
- **Environments never share secrets.** Each environment (local, staging,
  production) has its own `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, database
  credentials, and SMTP credentials. The dev placeholders in `.env.example`
  must never appear outside local development.

## Environments

### Local development

Fully self-hosted via Docker Compose (`docker-compose.yml` at the repo root):
Postgres, Redis, MinIO, and Mailpit (catches every outgoing email locally —
`http://localhost:8025`). Copy `.env.example` to `.env`, fill in values, then:

```bash
pnpm docker:dev   # start the infra containers
pnpm dev          # run apps/web and services/main
```

Ports are non-default by convention in this repo (`WEB_PORT=5330`,
backend `PORT=5331`, `MINIO_PORT=5332` in `.env.example`) — see that file for
the authoritative current list, and `turbo.json`'s `globalEnv` for the full
set of variables Turborepo is aware of.

### Staging (current, interim)

- `apps/web` — deployed to Vercel, Root Directory set to `apps/web`, purely
  for SEO warm-up on `loop.milvalabs.com`. `NEXT_PUBLIC_SITE_ENV=production`
  gates `robots.txt`/indexing — only set it to `production` on a deployment
  that should actually be crawled (see `apps/web/app/robots.ts`).
- `services/main` — **not yet deployed anywhere.** This is the first real gap
  to close once the auth/domain implementation lands: it needs a host (see
  "Target production topology" below) before `apps/web` can talk to a real
  backend outside local dev.
- No production Postgres/Redis/MinIO/SMTP exist yet outside Docker Compose.

### Production (target, not yet built)

Self-hosted. The exact provider (a VPS, a small managed-container platform,
etc.) is not yet decided and shouldn't be assumed by any code — but the
target shape is:

- `services/main` — containerized (a `Dockerfile` does not exist yet; this is
  a concrete next step, not yet built) or run as a managed Node process
  behind a reverse proxy, on `api.loop.milvalabs.com`.
- `apps/web` — self-hosted via `next build && next start` behind the same
  reverse proxy (or containerized alongside `services/main`), on
  `loop.milvalabs.com`.
- `COOKIE_DOMAIN=.loop.milvalabs.com` so the auth refresh cookie is readable
  by both subdomains.
- Postgres, Redis, MinIO — self-hosted equivalents of the Docker Compose
  services (a managed Postgres is acceptable operationally later; just don't
  couple application code to a provider-specific feature — see
  `CODE_QUALITY.md`).
- Real SMTP credentials in place of Mailpit.
- A reverse proxy (e.g. Caddy or nginx) terminating TLS for both subdomains.

## Deploying a change

There is no CI/CD pipeline yet — deploys are manual until one exists. Until
then, for any deploy:

1. `pnpm check-types && pnpm lint && pnpm build` clean at the commit being
   deployed.
2. Run any new database migrations against the target environment's Postgres
   (`pnpm --filter db db:migrate`, pointed at that environment's
   `DATABASE_URL`) **before** deploying the application code that depends on
   the new schema.
3. Deploy `services/main`, then `apps/web` (the API should be ready before the
   frontend that calls it is live).
4. Smoke-test the deployed environment end-to-end for whatever changed —
   matches the verification standard in `.agents/rules/MAIN.md`, applied
   against the real deployed environment, not just local dev.

## Rollback

- Application code: redeploy the previous known-good commit/build artifact.
- Database: a migration that is destructive (drops a column/table) must be
  deployed as two separate steps in production — stop writing to the old
  shape first, confirm the new code path is healthy, only then run the
  destructive migration in a later deploy. Never ship "add new column, remove
  old column" as a single migration once real data exists.

## Not yet in place (pre-launch checklist, not blocking family/friends testing)

- `services/main` and `apps/web` Dockerfiles / production build process.
- Real hosting decision and provisioning for production.
- CI (automated typecheck/lint/build/test on every push).
- Error tracking and uptime monitoring (see `CODE_QUALITY.md`'s Observability
  section).
- Automated database backups and a tested restore procedure.
- Real SMTP provider account.
- Rate limiting on public-facing endpoints, especially auth.

None of these block using the product privately with family/friends on the
current interim setup — they block onboarding any real, unrelated cooperative.
