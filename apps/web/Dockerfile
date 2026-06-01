# ── Dependencies stage ────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json  ./packages/shared/
COPY apps/web/package.json         ./apps/web/
COPY apps/backend/package.json     ./apps/backend/
COPY apps/admin/package.json       ./apps/admin/
COPY apps/mobile/package.json      ./apps/mobile/

RUN npm ci

# ── Build stage ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules          ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

COPY packages/shared/ ./packages/shared/
COPY apps/web/        ./apps/web/
COPY package.json     ./

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app/apps/web
RUN node node_modules/next/dist/bin/next build --webpack

# ── Production stage ──────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public                                  ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone  ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static      ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
