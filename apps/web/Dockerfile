# Built from the repo root: docker build -f apps/web/Dockerfile .
# Same three-stage Turborepo pattern as services/main/Dockerfile — see its
# comment for the full explanation. The runtime stage differs because
# Next.js's own `output: 'standalone'` (next.config.js) already traces the
# minimal server + node_modules subset a Next app needs, so there's no
# separate "which workspace packages does this need" problem to solve by
# hand the way a plain Node service has.

FROM node:22-alpine AS pruner
WORKDIR /app
RUN npm install -g turbo@^2.10.9
COPY . .
RUN turbo prune web --docker

FROM node:22-alpine AS installer
WORKDIR /app
RUN npm install -g pnpm@9.0.0
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
# NEXT_PUBLIC_* values are baked into the client bundle at build time, not
# read at runtime like every other env var here — they must be real for
# the environment this image is meant to run in, passed as build args at
# `docker build` / `docker compose build` time (see docker-compose.prod.yml).
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_ENV
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_ENV=$NEXT_PUBLIC_SITE_ENV
RUN pnpm turbo run build --filter=web

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
USER nextjs
# Documentation only — the standalone server.js reads PORT at runtime
# (docker-compose.prod.yml sets it to 5330, matching the local-dev
# convention).
EXPOSE 5330
CMD ["node", "apps/web/server.js"]
