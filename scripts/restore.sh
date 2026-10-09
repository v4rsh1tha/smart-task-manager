#!/usr/bin/env bash
# Usage: ./scripts/restore.sh backups/mongo-2026-10-08_0200.archive.gz
# Replaces the current data with the contents of the backup.
set -euo pipefail
FILE="${1:?Usage: $0 <backup file>}"
cd "$(dirname "$0")/.."
set -a; source .env; set +a
docker compose exec -T mongo mongorestore \
  --username "$MONGO_USER" --password "$MONGO_PASSWORD" --authenticationDatabase admin \
  --archive --gzip --drop < "$FILE"
echo "Restored from $FILE"
