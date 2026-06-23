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

# Compile the shared workspace to CommonJS so the runtime (node, not tsx) can
# require its VALUE exports (WORD_CATEGORIES, isPremiumActive, ANIMATION_*).
# The repo keeps shared's package.json main → src/*.ts for the web/admin
# bundlers (Next transpiles source at build time); we ship a compiled copy
# ONLY inside this backend image.
RUN npx tsc packages/shared/src/index.ts \
      --outDir packages/shared/dist \
      --module commonjs --moduleResolution node --target ES2020 \
      --declaration --esModuleInterop --skipLibCheck --resolveJsonModule

# ── Production stage ──────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json     ./apps/backend/

RUN npm ci --omit=dev

COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Point the in-image shared package at the compiled CJS output (git stays on
# src for the web/admin bundlers — see the build stage).
RUN node -e "const f='./packages/shared/package.json',p=require(f);p.main='./dist/index.js';p.types='./dist/index.d.ts';require('fs').writeFileSync(f,JSON.stringify(p,null,2))"

# Bundle migrations so the container is self-contained on first boot
COPY supabase/migrations/ ./migrations/
COPY supabase/seed.sql    ./migrations/002_seed.sql

RUN mkdir -p ./uploads/audio ./uploads/images ./uploads/pdfs

EXPOSE 4000
CMD ["node", "apps/backend/dist/index.js"]
