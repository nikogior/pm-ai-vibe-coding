#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="pm-ai-vibe-coding-container"

docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

echo "Stopped container: $CONTAINER_NAME"
