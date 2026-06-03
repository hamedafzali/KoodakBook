FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json  ./packages/shared/
COPY apps/admin/package.json       ./apps/admin/
COPY apps/web/package.json         ./apps/web/
COPY apps/backend/package.json     ./apps/backend/
COPY apps/mobile/package.json      ./apps/mobile/
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules            ./node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules
COPY packages/shared/ ./packages/shared/
COPY apps/admin/      ./apps/admin/
COPY package.json     ./
ENV NEXT_TELEMETRY_DISABLED=1
# Receive backend URL at build time so Next.js bakes it into the bundle
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
WORKDIR /app/apps/admin
RUN node node_modules/next/dist/bin/next build --webpack

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static     ./apps/admin/.next/static
USER nextjs
EXPOSE 3001
ENV PORT=3001
CMD ["node", "apps/admin/server.js"]
