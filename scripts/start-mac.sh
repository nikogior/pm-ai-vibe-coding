#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="pm-ai-vibe-coding"
CONTAINER_NAME="pm-ai-vibe-coding-container"
PORT=8000

cd "$(dirname "$0")/.."

docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker build -t "$IMAGE_NAME" .
docker run --rm -d --name "$CONTAINER_NAME" \
  -p "$PORT:8000" \
  -v pm-ai-vibe-coding-data:/data \
  --env-file .env \
  "$IMAGE_NAME"

echo "Application started at http://localhost:$PORT"
