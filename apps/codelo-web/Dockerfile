# Multi-stage build for codelo-web (Next.js 16, standalone output).
# Build context = monorepo root.
#
#   docker build -f apps/codelo-web/Dockerfile -t codelo/web .

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ---- deps: workspace dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/codelo-web/package.json apps/codelo-web/
RUN pnpm install --frozen-lockfile --filter "codelo-web..."

# ---- build: compile Next.js ----
FROM deps AS build
COPY apps/codelo-web apps/codelo-web

# Build Next.js (produces .next/standalone with self-contained server.js).
# No database here — all content comes from the CMS at request time.
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=1
RUN cd apps/codelo-web && pnpm exec next build

# ---- runtime: minimal image with just the standalone bundle ----
FROM node:22-alpine AS runtime
RUN apk add --no-cache wget && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs
WORKDIR /app

# Copy the standalone output (which includes node_modules of used packages).
COPY --from=build --chown=nextjs:nodejs /repo/apps/codelo-web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/codelo-web/.next/static ./apps/codelo-web/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/codelo-web/public ./apps/codelo-web/public

USER nextjs
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health > /dev/null || exit 1

CMD ["node", "apps/codelo-web/server.js"]
