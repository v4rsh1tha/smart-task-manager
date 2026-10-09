#!/usr/bin/env bash
# Saves a compressed copy of the database into ./backups and keeps the newest 7.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
mkdir -p backups
FILE="backups/mongo-$(date +%F_%H%M).archive.gz"

docker compose exec -T mongo mongodump \
  --username "$MONGO_USER" --password "$MONGO_PASSWORD" --authenticationDatabase admin \
  --db smart-task-manager --archive --gzip > "$FILE" || { rm -f "$FILE"; echo "Backup failed"; exit 1; }

[ -s "$FILE" ] || { rm -f "$FILE"; echo "Backup was empty, removed"; exit 1; }
ls -1t backups/mongo-*.archive.gz | tail -n +8 | xargs -r rm --
echo "Backup saved: $FILE"
