#!/bin/sh
# One-command deploy: pull latest, rebuild, restart, show migration/seed output.
#
# Prereq: the server checkout must be a REAL git clone of this repo (so `git pull`
# works). See DEPLOY.md → "Server must be a git checkout".
#
# ── Authoritative env file ──────────────────────────────────────────────
# `.env` (plain, no suffix) in this directory is THE live config — Compose
# reads it by default, DEPLOY.md's admin-seed docs assume it, and this
# script now passes it explicitly with `--env-file` so there's no implicit
# fallback to depend on. Do not create `.env.prod` / `.env.<anything>`
# side files "for prod" — a stray one of those is exactly what silently
# broke NEXT_PUBLIC_SITE_URL in production on 2026-09-09 (docker-compose.yml
# fell back to `http://localhost:3000` for a var nobody was actually
# passing, because deploy.sh had no --env-file flag and the correct value
# was sitting unused in `.env.prod`). If you keep a separate file for
# reference (e.g. a template for a second environment), name it so it can
# never be mistaken for live config and keep it outside this directory.
#
# To add a new required var safely:
#   1. Add it to `.env` on the server (and to `.env.example` here in git).
#   2. In docker-compose.yml, reference it as ${VAR:?some error message} —
#      NOT ${VAR:-some-default} — if the app breaks (or worse, silently
#      misbehaves) without it. A bare fallback is fine only for a value
#      that's genuinely optional in every environment.
#   3. Redeploy and confirm the preflight check below (and Compose's own
#      `:?` guard) catch a missing value before anything ships.
#
# Usage (on the server, from the repo dir):
#   ./deploy.sh                 # uses docker-compose.yml + .env
#   COMPOSE=docker-compose.prod.yml ./deploy.sh   # different compose file, still .env
set -e

cd "$(dirname "$0")"
COMPOSE="${COMPOSE:-docker-compose.yml}"
ENV_FILE="${ENV_FILE:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "✗ $ENV_FILE not found in $(pwd) — refusing to deploy with no env file." >&2
  echo "  Copy .env.example to $ENV_FILE and fill in real values first." >&2
  exit 1
fi

# Preflight: catch a missing production-critical var here, with a clear
# message, before burning a build on it — Compose's own ${VAR:?...} guards
# in docker-compose.yml are the real backstop, but failing this early and
# by name is faster to diagnose than a mid-build Compose error.
missing=""
for var in NEXT_PUBLIC_SITE_URL POSTGRES_PASSWORD JWT_SECRET ADMIN_EMAIL ADMIN_PASSWORD; do
  # grep for a non-empty assignment; a commented-out or blank line doesn't count.
  if ! grep -qE "^${var}=.+" "$ENV_FILE"; then
    missing="$missing $var"
  fi
done
if [ -n "$missing" ]; then
  echo "✗ $ENV_FILE is missing required var(s):$missing" >&2
  echo "  Set them in $ENV_FILE before deploying — see this script's header." >&2
  exit 1
fi

echo "▶ Pulling latest…"
git pull --ff-only

echo "▶ Building & restarting ($COMPOSE, env: $ENV_FILE)…"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE" up -d --build

echo "▶ Backend startup (migrations + admin seed run automatically):"
sleep 6
docker compose --env-file "$ENV_FILE" -f "$COMPOSE" logs --tail=40 backend | grep -iE "migrat|seed|admin|running|error" || true

echo "▶ Containers:"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE" ps
echo "✓ Deploy complete."
