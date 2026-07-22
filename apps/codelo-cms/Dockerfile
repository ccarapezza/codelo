# Multi-stage build for codelo-cms (Strapi 5 production).
# Build context = monorepo root.
#
#   docker build -f apps/codelo-cms/Dockerfile -t codelo/cms .

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate && \
    apk add --no-cache vips-dev build-base python3
WORKDIR /repo

# ---- deps ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/codelo-cms/package.json apps/codelo-cms/
RUN pnpm install --frozen-lockfile --filter "codelo-cms..."

# ---- build: compile admin panel SPA ----
FROM deps AS build
COPY apps/codelo-cms apps/codelo-cms
ENV NODE_ENV=production
# `types/generated/` está gitignoreado: son artefactos derivados de los schemas.
# En local aparecen al correr el comando a mano, pero un build limpio de Docker
# parte de un checkout que NO los tiene, y sin ellos `strapi build` typechequea
# contra el `ContentType` genérico y falla con TS2559/TS2353 en cada `.update()`
# — incluidos los de código que nunca se tocó.
#
# El comando no necesita base de datos (lee los schemas del disco), así que
# puede correr acá dentro sin depender de Postgres.
RUN cd apps/codelo-cms && pnpm exec strapi ts:generate-types && pnpm exec strapi build

# ---- runtime ----
FROM node:22-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate && \
    apk add --no-cache vips wget ffmpeg && \
    addgroup -g 1001 -S nodejs && \
    adduser -S strapi -u 1001 -G nodejs
WORKDIR /repo

COPY --from=build --chown=strapi:nodejs /repo/package.json /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml ./
COPY --from=build --chown=strapi:nodejs /repo/node_modules ./node_modules
COPY --from=build --chown=strapi:nodejs /repo/apps/codelo-cms ./apps/codelo-cms

USER strapi
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1337

EXPOSE 1337

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:1337/_health > /dev/null || exit 1

WORKDIR /repo/apps/codelo-cms
CMD ["pnpm", "exec", "strapi", "start"]
