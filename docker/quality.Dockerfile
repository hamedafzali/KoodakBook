# Static quality gate for the CI pipeline.
#
# Typechecks the TypeScript workspaces (backend, admin, shared) via their `lint`
# tasks (`tsc --noEmit`). The web app is excluded here: its eslint config is
# currently broken upstream, and the web app's types are already enforced by
# `next build` when the web image is built in the e2e stage.
#
# Built (not bind-mounted) so the build context is streamed to the Docker daemon
# — this works under ACM's Docker-in-Docker runner. .dockerignore keeps the
# context lean (no node_modules/.next/.git).
FROM node:20-bookworm-slim

WORKDIR /repo
COPY . .

# The repo ships a package-lock.json; fall back to a plain install if `ci`
# can't reconcile it (mirrors the e2e image's install strategy).
RUN npm ci || npm install

# Non-zero exit fails the stage.
CMD ["npx", "turbo", "lint", "--filter=!@koodakbook/web"]
