#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export LIMPAE_PROXY_TARGET="${LIMPAE_PROXY_TARGET:-https://limpae-jcqa.onrender.com}"
export LIMPAE_PROXY_PORT="${LIMPAE_PROXY_PORT:-8787}"

cd "$ROOT_DIR"

echo "[limpae bash] backend: ${LIMPAE_PROXY_TARGET}"
echo "[limpae bash] porta:   ${LIMPAE_PROXY_PORT}"

exec node scripts/start-expo-proxy.js "$@"
