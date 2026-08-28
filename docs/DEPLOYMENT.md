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

Ports are non-default by convention in this repo, assigned sequentially
starting at 5330 (`WEB_PORT=5330`, backend `PORT=5331`, Postgres on `5333`
via `DATABASE_URL`, `MINIO_PORT=5334`, Redis on `5335` via `REDIS_URL`) —
this keeps per-project data stores from colliding when several of this
machine's projects run locally at once. Mailpit is the deliberate exception,
left on its default ports (`1025`/`8025`) so dev email from every project
lands in one shared inbox instead of a separate Mailpit per project. See
`.env.example` for the authoritative current list, and `turbo.json`'s
`globalEnv` for the full set of variables Turborepo is aware of.

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

### Production (target, provisioning not yet done)

Self-hosted on a private VPS. `services/main` and `apps/web` are both
containerized (`services/main/Dockerfile`, `apps/web/Dockerfile`) and run
via `docker-compose.prod.yml` alongside self-hosted Postgres, Redis, and
MinIO — one compose file, kept entirely separate from the local-dev-only
`docker-compose.yml` at the repo root. The target shape:

- `services/main`, on `api.loop.milvalabs.com`.
- `apps/web`, built with Next.js's `output: 'standalone'` (`next.config.js`)
  so its image only carries the production dependency subset a Next server
  actually needs, on `loop.milvalabs.com`.
- `COOKIE_DOMAIN=.loop.milvalabs.com` so the auth refresh cookie is readable
  by both subdomains.
- Postgres, Redis, MinIO — self-hosted equivalents of the Docker Compose
  services (a managed Postgres is acceptable operationally later; just don't
  couple application code to a provider-specific feature — see
  `CODE_QUALITY.md`). MinIO isn't reachable from outside the Docker network
  yet — nothing in the app stores or serves a file through it yet (see
  `packages/storage`), so there's no presigned-URL-needs-a-public-hostname
  problem to solve until that first real feature lands.
- Real SMTP credentials in place of Mailpit (`docker-compose.prod.yml` has no
  Mailpit service at all).
- **Not yet in place**: a reverse proxy (e.g. Caddy or nginx) terminating TLS
  for both subdomains. Until this exists, `main`/`web` are reachable directly
  over plain HTTP — fine for private family/friends testing, not for any
  real cooperative's data (see the principles above).
- The VPS itself is not yet provisioned, and no domain points at it yet.

## Deploying a change

`.github/workflows/deploy.yml` runs on a self-hosted GitHub Actions runner
living on the production VPS, triggered on every push to `main` (or
manually via `workflow_dispatch`). Since the runner *is* the VPS, every step
runs directly there — no SSH, no image registry, no artifact upload between
jobs. On each run it:

1. Writes `.env` at the repo root from the `PRODUCTION_ENV` secret (see
   "Secrets" below).
2. Runs `pnpm check-types && pnpm lint && pnpm test && pnpm build` — the same
   bar as any change to this repo, checked fresh rather than trusted from a
   PR's own CI run.
3. Starts Postgres/Redis/MinIO and waits for their healthchecks
   (`docker compose -f docker-compose.prod.yml up -d --wait postgres redis
   minio`).
4. Runs pending migrations (`pnpm --filter @milvaloop/db db:migrate`)
   **before** touching `main`/`web` — see the migrations-first principle
   above.
5. Builds and restarts `main` and `web`
   (`docker compose -f docker-compose.prod.yml up -d --build main web`).
6. Prunes unused images.

A concurrency group serializes deploys — a second push mid-deploy queues
behind the first rather than racing it.

### Secrets

The entire production `.env` file's contents live as one value in a
`PRODUCTION_ENV` secret, on a `production` environment in this repo's
Settings (Settings → Environments → New environment) rather than a plain
repo-level secret — that's what lets the deploy job restrict which branch
can use it, and optionally require manual approval before a deploy runs.
The workflow writes it to `.env` fresh on every run rather than keeping a
standing file on the VPS, so rotating a secret is an edit in GitHub, not an
SSH session — a self-hosted runner still gets secrets injected the normal
way, decrypted only in-memory for that run and never printed to logs.

Fill it in with real values, using `.env.example`'s shape as the reference
— never that file's own dev placeholders (see the "environments never share
secrets" principle above). `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`
need real values too (see `.env.example`'s comment on them).

`REDIS_URL`/`MINIO_ENDPOINT`/`MINIO_PORT` can keep their `.env.example`
shape — `docker-compose.prod.yml` overrides them for `main`'s own
container, so they only need to be present and syntactically valid for the
deploy workflow's check-types/test/build step, which validates them
without ever actually connecting.

`DATABASE_URL` is the one exception: unlike the others, it's actually used
live, by the migration step, which runs directly on the VPS host rather
than inside a container — so it must point at Postgres's host-mapped port
(`postgres://<user>:<password>@localhost:5333/<db>`), not the internal
Docker hostname `main`'s own container uses. Get this one wrong and
migrations fail with a connection error, not a validation error.

## Rollback

- Application code: redeploy the previous known-good commit/build artifact —
  concretely, `git revert` the bad commit on `main` (or re-run
  `workflow_dispatch` against the last good commit) so the deploy workflow
  rebuilds and restarts `main`/`web` from that known-good state. Images
  aren't tagged by commit yet (`docker compose build` always produces
  `:latest`), so there is no way to roll back to a previous image without
  rebuilding it from source — worth revisiting once deploys are frequent
  enough for that rebuild time to matter.
- Database: a migration that is destructive (drops a column/table) must be
  deployed as two separate steps in production — stop writing to the old
  shape first, confirm the new code path is healthy, only then run the
  destructive migration in a later deploy. Never ship "add new column, remove
  old column" as a single migration once real data exists.

## Not yet in place (pre-launch checklist, not blocking family/friends testing)

- Real hosting decision and provisioning for production (the VPS itself
  isn't provisioned yet, and no domain points at it).
- A reverse proxy (Caddy or nginx) terminating TLS for both subdomains — see
  "Production" above.
- Error tracking and uptime monitoring (see `CODE_QUALITY.md`'s Observability
  section).
- Automated database backups and a tested restore procedure.
- Real SMTP provider account.
- Commit-tagged images, so a rollback doesn't require a full rebuild (see
  "Rollback" above).

None of these block using the product privately with family/friends on the
current interim setup — they block onboarding any real, unrelated cooperative.
