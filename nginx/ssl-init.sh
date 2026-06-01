#!/bin/sh
# Run this ONCE on the server before starting the prod stack
# Usage: DOMAIN=yourdomain.com EMAIL=you@email.com sh nginx/ssl-init.sh

set -e

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Usage: DOMAIN=yourdomain.com EMAIL=you@email.com sh nginx/ssl-init.sh"
  exit 1
fi

echo "Getting SSL certificates for $DOMAIN and api.$DOMAIN ..."

docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  -p 80:80 \
  certbot/certbot certonly \
    --standalone \
    --agree-tos \
    --no-eff-email \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    -d "api.$DOMAIN"

echo "SSL certificates obtained. You can now run: docker compose -f docker-compose.prod.yml up -d"
