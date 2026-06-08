# Bake the Playwright tests into an image instead of bind-mounting them.
# ACM runs `docker compose` from inside its own container via the Docker socket,
# so a relative bind mount (./e2e) would resolve to a host path that doesn't
# exist and mount empty. A build context is streamed to the daemon, so it works.
FROM mcr.microsoft.com/playwright:v1.49.1-jammy
WORKDIR /work/e2e
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["npx", "playwright", "test"]
