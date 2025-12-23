#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[dev] Starting Docker services (postgres/redis/minio/pyworker)…"
cd "$ROOT_DIR"
docker compose up -d

echo "[dev] Installing web dependencies (if needed)…"
npm --prefix web install

echo "[dev] Applying DB migrations (deploy) and seeding default admin user…"
# deploy is non-interactive and uses existing migrations
npm --prefix web run db:deploy
npm --prefix web run db:seed

echo "[dev] Starting Next.js dev server + BullMQ worker…"
# Run both long-lived processes and clean them up on exit
npm --prefix web run dev &
WEB_PID=$!

npm --prefix web run worker:dev &
WORKER_PID=$!

cleanup() {
  echo ""
  echo "[dev] Shutting down…"
  kill "$WORKER_PID" 2>/dev/null || true
  kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[dev] Web:    http://localhost:3000"
echo "[dev] Pyworker: http://localhost:8000/health"

echo "[dev] Press Ctrl+C to stop."
wait "$WEB_PID"
