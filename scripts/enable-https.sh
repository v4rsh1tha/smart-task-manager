#!/usr/bin/env bash
# Usage: ./scripts/enable-https.sh yourdomain.example.com you@email.com
# Before running: the domain must point to this VM, and ports 80 and 443 must be open.
set -euo pipefail
DOMAIN="${1:?Usage: $0 <domain> <email>}"
EMAIL="${2:?Usage: $0 <domain> <email>}"
cd "$(dirname "$0")/.."

echo "1/4 Starting the stack on plain HTTP..."
docker compose up -d --build

echo "2/4 Asking Let's Encrypt for a certificate for $DOMAIN..."
docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot -d "$DOMAIN" \
  --email "$EMAIL" --agree-tos --no-eff-email --non-interactive

echo "3/4 Switching Nginx to HTTPS..."
sed "s/__DOMAIN__/$DOMAIN/g" nginx/https.conf.template > nginx/conf.d/default.conf
docker compose exec web nginx -t

echo "4/4 Reloading Nginx..."
docker compose exec web nginx -s reload
echo "Done. Open https://$DOMAIN"
