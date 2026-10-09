#!/usr/bin/env bash
# Creates .env with random secrets, so you don't have to invent them.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then echo ".env already exists, leaving it alone."; exit 0; fi
cp .env.example .env
sed -i "s/^MONGO_PASSWORD=.*/MONGO_PASSWORD=$(openssl rand -hex 16)/" .env
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
echo "Created .env with random secrets."
