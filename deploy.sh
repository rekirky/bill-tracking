#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Pulling latest images and starting containers..."
docker compose pull
docker compose up -d

echo "Deploy complete."
docker compose ps
