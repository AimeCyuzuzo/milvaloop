# Built from the repo root: docker build -f services/main/Dockerfile .
# Three stages, following Turborepo's own documented monorepo pattern
# (https://turborepo.dev/docs/guides/tools/docker): prune the monorepo down
# to just what @milvaloop/main actually depends on, install and build that
# subset, then copy only the built output into a minimal runtime image —
# never the whole monorepo's source or devDependencies.

FROM node:22-alpine AS pruner
WORKDIR /app
RUN npm install -g turbo@^2.10.9
COPY . .
RUN turbo prune @milvaloop/main --docker

FROM node:22-alpine AS installer
WORKDIR /app
RUN npm install -g pnpm@9.0.0
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=@milvaloop/main

# node_modules here already has every workspace package's `dist` resolved
# via pnpm's symlinks (drizzle-orm, @milvaloop/db, @milvaloop/email, etc.)
# from the build step above — nothing further to compile at runtime.
FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=installer --chown=nestjs:nodejs /app .
USER nestjs
# Documentation only — the actual listen port comes from the PORT env var
# at runtime (docker-compose.prod.yml sets it to 5331, matching the
# local-dev convention).
EXPOSE 5331
CMD ["node", "services/main/dist/main.js"]
