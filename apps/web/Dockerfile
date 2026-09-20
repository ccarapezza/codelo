# Multi-stage build for codelo-web (Next.js 16, standalone output).
# Build context = monorepo root.
#
#   docker build -f apps/web/Dockerfile -t codelo/web .

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ---- deps: workspace dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter "@nib/web..."

# ---- build: compile Next.js ----
FROM deps AS build
COPY apps/web apps/web

# La CSP `frame-ancestors` se resuelve en next.config `headers()`, que Next
# evalúa en BUILD y hornea en el bundle standalone. Para que el iframe de
# "Vista previa" del panel pueda embeber la web en prod, el origen del CMS
# tiene que estar disponible acá (no alcanza con setearlo en runtime).
ARG PREVIEW_FRAME_ANCESTOR=""
ENV PREVIEW_FRAME_ANCESTOR=$PREVIEW_FRAME_ANCESTOR

# Build Next.js (produces .next/standalone with self-contained server.js).
# No database here — all content comes from the CMS at request time.
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=1
RUN cd apps/web && pnpm exec next build

# ---- runtime: minimal image with just the standalone bundle ----
FROM node:22-alpine AS runtime
RUN apk add --no-cache wget && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs
WORKDIR /app

# Copy the standalone output (which includes node_modules of used packages).
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health > /dev/null || exit 1

CMD ["node", "apps/web/server.js"]
