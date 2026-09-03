# KoodakBook — Deployment Guide

## Server Requirements

- Ubuntu 22.04+ (or any Linux with Docker support)
- Docker Engine 24+
- Docker Compose v2
- 2 GB RAM minimum (4 GB recommended)
- 20 GB disk minimum
- Ports 80 and 443 open in firewall
- A domain name pointed at your server IP (e.g. `koodakbook.com`)
- A subdomain for the API (e.g. `api.koodakbook.com`)

---

## First-Time Setup

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Clone the repository

```bash
git clone <your-repo-url> /opt/koodakbook
cd /opt/koodakbook
```

### 3. Create environment file

```bash
cp .env.example .env
nano .env
```

Fill in all values:

```env
DB_PASSWORD=<strong-random-password>
JWT_SECRET=<64-char-random-string>
WEB_URL=https://koodakbook.com
NEXT_PUBLIC_BACKEND_URL=https://api.koodakbook.com
ADMIN_EMAIL=your@email.com
ADMIN_PASSWORD=<strong-admin-password>
DOMAIN=koodakbook.com
```

Generate a strong JWT secret:
```bash
openssl rand -hex 48
```

### 4. Get SSL certificates

Make sure your domain DNS is pointing to the server, then run:

```bash
DOMAIN=koodakbook.com EMAIL=your@email.com sh nginx/ssl-init.sh
```

This gets certificates for both `koodakbook.com` and `api.koodakbook.com`.

### 5. Deploy

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

First run takes 5–10 minutes (builds images, initializes DB, seeds data).

### 6. Verify

```bash
# Check all containers are running
docker compose -f docker-compose.prod.yml ps

# Check backend health
curl https://api.koodakbook.com/health

# Check web is up
curl -I https://koodakbook.com
```

---

## Admin Panel Access

> This section describes the **live setup** (ACM-managed `docker-compose.yml`
> + Cloudflare tunnel), not the `docker-compose.prod.yml`/nginx path this file
> otherwise documents — see the note at the top of "Updating After Code
> Changes" for why that file is dormant.

The admin panel (`admin` service, host port `3002`) is bound to `127.0.0.1`
only on the server — not reachable from the LAN or the internet, by design
(see the `ports:` comment on `admin` in `docker-compose.yml` for why). `web`
(port `3001`) stays on `0.0.0.0` since it's the one service the Cloudflare
tunnel routes to.

Access the admin panel via SSH tunnel from your local machine:

```bash
ssh -L 3002:127.0.0.1:3002 hamed@192.168.178.37
```

Then open `http://localhost:3002` in your browser. Login with `ADMIN_EMAIL`
and `ADMIN_PASSWORD` (ACM project variables on the server).

---

## Updating After Code Changes

> **The server directory MUST be a real git checkout** of this repo, or `git pull`
> updates nothing and the server silently drifts from the repo (this has bitten us).
> Verify with `git -C <dir> rev-parse --is-inside-work-tree`. If it prints `fatal:
> not a git repository`, convert it once (back up `.env`, `git init` + add the
> remote + `git fetch` + `git checkout -f main`, restore `.env`).

```bash
cd /data/projects/KoodakBook   # the deploy checkout
./deploy.sh                    # pull + build + restart + show migration/seed logs
# or, per environment:
COMPOSE=docker-compose.prod.yml ./deploy.sh
```

What happens on `up -d --build`:
- **DB migrations run automatically** on backend boot (`migrate()`), so schema +
  content updates (e.g. audio, i18n) apply with no manual SQL.
- **The admin account is re-seeded from env** (`seedAdmin()`): it creates the
  admin if missing and **re-syncs the password when `ADMIN_PASSWORD` changes**.
  Admin credentials therefore come from the server's `.env`
  (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) — not the dev defaults.

---

## Renewing SSL Certificates

Certificates from Let's Encrypt expire after 90 days. Renew with:

```bash
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  certbot/certbot renew --quiet

docker compose -f docker-compose.prod.yml restart nginx
```

Set this as a monthly cron job:
```bash
crontab -e
# Add:
0 3 1 * * cd /opt/koodakbook && docker run --rm -v /etc/letsencrypt:/etc/letsencrypt -v /var/lib/letsencrypt:/var/lib/letsencrypt certbot/certbot renew --quiet && docker compose -f docker-compose.prod.yml restart nginx
```

---

## Database Backup

```bash
# Backup
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U koodakbook koodakbook > backup_$(date +%Y%m%d).sql

# Restore
cat backup_20260101.sql | docker compose -f docker-compose.prod.yml exec -T db \
  psql -U koodakbook koodakbook
```

---

## Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f nginx
```

---

## Troubleshooting

**502 Bad Gateway from Nginx**
```bash
# Check backend/web are running
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs backend
```

**DB connection error**
```bash
# Check DB is healthy
docker compose -f docker-compose.prod.yml exec db pg_isready -U koodakbook
```

**Disk full**
```bash
df -h
# Clean unused Docker resources (does NOT remove volumes)
docker system prune -f
```
