#!/bin/sh
# One-command deploy: pull latest, rebuild, restart, show migration/seed output.
#
# Prereq: the server checkout must be a REAL git clone of this repo (so `git pull`
# works). See DEPLOY.md → "Server must be a git checkout".
#
# Usage (on the server, from the repo dir):
#   ./deploy.sh                 # uses docker-compose.yml
#   COMPOSE=docker-compose.prod.yml ./deploy.sh
set -e

cd "$(dirname "$0")"
COMPOSE="${COMPOSE:-docker-compose.yml}"

echo "▶ Pulling latest…"
git pull --ff-only

echo "▶ Building & restarting ($COMPOSE)…"
docker compose -f "$COMPOSE" up -d --build

echo "▶ Backend startup (migrations + admin seed run automatically):"
sleep 6
docker compose -f "$COMPOSE" logs --tail=40 backend | grep -iE "migrat|seed|admin|running|error" || true

echo "▶ Containers:"
docker compose -f "$COMPOSE" ps
echo "✓ Deploy complete."
