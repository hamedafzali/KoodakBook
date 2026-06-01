# ── Build stage ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json     ./apps/backend/

RUN npm ci

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/backend/    ./apps/backend/

RUN npm run build --workspace=@koodakbook/backend

# ── Production stage ──────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json     ./apps/backend/

RUN npm ci --omit=dev

COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY packages/shared/src ./packages/shared/src

RUN mkdir -p ./uploads/audio ./uploads/images ./uploads/pdfs

EXPOSE 4000
CMD ["node", "apps/backend/dist/index.js"]
